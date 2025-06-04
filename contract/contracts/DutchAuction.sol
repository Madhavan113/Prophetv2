// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./ShareToken.sol";

/**
 * @title DutchAuction
 * @dev Linear Dutch auction for ERC20 ShareTokens with batched processing
 * and pro-rata allocation.
 */
contract DutchAuction is ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;
    using Math for uint256; // Properly attach the Math library to uint256

    ShareToken public immutable shareToken;
    address public immutable artist;
    uint256 public immutable totalSupply;
    uint256 public immutable startPrice;
    uint256 public immutable floorPrice;
    uint256 public immutable duration;
    uint256 public immutable startTime;
    uint256 public immutable endTime;

    // Track scaling factor to ensure consistent token allocation
    uint256 public scalingFactor = 1e18; // 1.0 represented as fixed point (initialized in finalize)
    bool public scalingFactorLocked = false;
    
    // Maximum bidders to process in a single finalize call
    uint256 public constant MAX_BIDDERS_PER_BATCH = 50;
    uint256 public nextBidderToProcess;
    bool public finalized;
    bool public allTokensDistributed;
    uint256 public clearingPrice;
    
    // Track funds
    uint256 public totalETHForArtist;
    uint256 public totalTokensRequested;
    uint256 public totalTokensDistributed;

    EnumerableSet.AddressSet private bidders;
    mapping(address => uint256) public committedETH;
    mapping(address => uint256) public tokensWon;
    mapping(address => uint256) public pendingRefunds;
    mapping(address => bool) public refunded;

    event Bid(address indexed bidder, uint256 ethAmount);
    event AuctionFinalized(uint256 clearingPrice, uint256 totalETHForArtist, uint256 scalingFactor);
    event BatchProcessed(uint256 batchSize, uint256 nextBidder, bool complete);
    event RefundScheduled(address indexed bidder, uint256 amount);
    event RefundClaimed(address indexed bidder, uint256 amount);
    event TokensDistributed(address indexed bidder, uint256 amount);
    event ArtistPaid(uint256 amount);

    constructor(
        address shareTokenAddress,
        address artistAddress,
        uint256 totalSupply_,
        uint256 startPrice_,
        uint256 floorPrice_,
        uint256 durationSeconds_
    ) {
        require(shareTokenAddress != address(0), "Invalid token");
        require(artistAddress != address(0), "Invalid artist");
        require(startPrice_ > floorPrice_, "Start price must be > floor");
        require(durationSeconds_ > 0, "Duration must be > 0");
        require(totalSupply_ > 0, "Supply must be > 0");

        shareToken = ShareToken(shareTokenAddress);
        artist = artistAddress;
        totalSupply = totalSupply_;
        startPrice = startPrice_;
        floorPrice = floorPrice_;
        duration = durationSeconds_;
        startTime = block.timestamp;
        endTime = block.timestamp + durationSeconds_;
    }

    function currentPrice() public view returns (uint256) {
        if (block.timestamp >= endTime) return floorPrice;
        uint256 elapsed = block.timestamp - startTime;
        uint256 priceDiff = startPrice - floorPrice;
        uint256 priceDecay = (priceDiff * elapsed) / duration;
        return startPrice - priceDecay;
    }

    function bid() external payable nonReentrant {
        require(block.timestamp >= startTime && block.timestamp < endTime, "Auction not active");
        require(!finalized, "Auction finalized");
        require(msg.value > 0, "No ETH sent");
        
        // Protect against unreasonable requests and overflow
        require(msg.value <= 100 ether, "Bid too large");

        // Safe way to calculate tokens without overflow
        uint256 price = currentPrice();
        uint256 tokensMax;
        unchecked {
            // Safe from overflow since we checked msg.value bounds
            tokensMax = (msg.value * 1e18) / price;
        }
        
        // Track total tokens requested - no need to check exact supply at this stage
        totalTokensRequested += tokensMax;

        if (committedETH[msg.sender] == 0) {
            bidders.add(msg.sender);
        }
        committedETH[msg.sender] += msg.value;

        emit Bid(msg.sender, msg.value);

        // Auto-finalize if auction time is over
        if (block.timestamp >= endTime) {
            finalize();
        }
    }

    function finalize() public nonReentrant {
        require(!finalized, "Already finalized");
        require(block.timestamp >= endTime || totalTokensRequested >= totalSupply, "Auction not ended");

        finalized = true;
        clearingPrice = currentPrice();
        
        // Calculate scaling factor once
        calculateScalingFactor();
        
        // Start processing batches
        processBatch();
    }
    
    function calculateScalingFactor() internal {
        require(!scalingFactorLocked, "Scaling already set");
        scalingFactorLocked = true;
        
        // Calculate total tokens wanted at clearing price
        uint256 totalTokensWanted = 0;
        uint256 n = bidders.length();
        
        // If there are too many bidders, we need to use batched calculation
        // But for this core calculation, we must process all bidders
        for (uint256 i = 0; i < n; i++) {
            address bidder = bidders.at(i);
            uint256 ethCommitted = committedETH[bidder];
            uint256 tokens = (ethCommitted * 1e18) / clearingPrice;
            totalTokensWanted += tokens;
        }
        
        // Calculate scaling factor only if oversubscribed
        if (totalTokensWanted > totalSupply) {
            // Scale down proportionally: multiply by scaling factor (< 1.0)
            scalingFactor = (totalSupply * 1e18) / totalTokensWanted;
        } else {
            scalingFactor = 1e18; // No scaling needed (1.0)
        }
    }
    
    function processBatch() public nonReentrant {
        require(finalized, "Not finalized");
        require(!allTokensDistributed, "All tokens distributed");
        require(scalingFactorLocked, "Scaling not set");
        
        uint256 n = bidders.length();
        // Fixed Math.min usage with proper library application
        uint256 endIdx = Math.min(nextBidderToProcess + MAX_BIDDERS_PER_BATCH, n);
        uint256 remainingSupply = totalSupply - totalTokensDistributed;
        
        // Process a batch of bidders
        uint256 batchTokensDistributed = 0;
        
        for (uint256 i = nextBidderToProcess; i < endIdx; i++) {
            address bidder = bidders.at(i);
            uint256 ethCommitted = committedETH[bidder];
            
            // Calculate tokens at clearing price
            uint256 rawTokenAmount = (ethCommitted * 1e18) / clearingPrice;
            
            // Apply scaling if needed
            uint256 scaledTokens;
            unchecked {
                // Safe from overflow since scaling factor <= 1e18
                scaledTokens = (rawTokenAmount * scalingFactor) / 1e18;
            }
            
            // Track refunds for pull pattern
            if (ethCommitted > 0) {
                uint256 ethNeeded = (scaledTokens * clearingPrice) / 1e18;
                if (ethCommitted > ethNeeded && !refunded[bidder]) {
                    uint256 refundAmount = ethCommitted - ethNeeded;
                    pendingRefunds[bidder] = refundAmount;
                    refunded[bidder] = true;
                    emit RefundScheduled(bidder, refundAmount);
                }
            }
            
            // Track tokens and add to batch total
            tokensWon[bidder] = scaledTokens;
            batchTokensDistributed += scaledTokens;
            
            // First transfer tokens, then handle refunds separately
            if (scaledTokens > 0 && remainingSupply >= scaledTokens) {
                remainingSupply -= scaledTokens;
                shareToken.transferOut(bidder, scaledTokens);
                emit TokensDistributed(bidder, scaledTokens);
            }
        }
        
        // Update total tokens distributed
        totalTokensDistributed += batchTokensDistributed;
        
        // Calculate ETH for artist based on total tokens distributed in this batch
        // This prevents precision loss from individual calculations
        uint256 batchETHForArtist = (batchTokensDistributed * clearingPrice) / 1e18;
        
        // Update artist payment tracking
        totalETHForArtist += batchETHForArtist;
        nextBidderToProcess = endIdx;
        
        // Check if complete
        if (nextBidderToProcess >= n) {
            allTokensDistributed = true;
            
            // Transfer ETH to artist only after all tokens distributed
            // Only send the exact amount calculated, not the contract balance
            if (totalETHForArtist > 0) {
                (bool sentArtist, ) = artist.call{value: totalETHForArtist}("");
                require(sentArtist, "Artist payment failed");
                emit ArtistPaid(totalETHForArtist);
            }
            
            emit AuctionFinalized(clearingPrice, totalETHForArtist, scalingFactor);
        }
        
        emit BatchProcessed(endIdx - nextBidderToProcess, nextBidderToProcess, allTokensDistributed);
    }
    
    // Allow users to claim refunds using pull pattern
    function claimRefund() external nonReentrant {
        uint256 refundAmount = pendingRefunds[msg.sender];
        require(refundAmount > 0, "No refund pending");
        
        pendingRefunds[msg.sender] = 0;
        (bool sent, ) = msg.sender.call{value: refundAmount}("");
        require(sent, "Refund failed");
        
        emit RefundClaimed(msg.sender, refundAmount);
    }

    function getBidders() external view returns (address[] memory) {
        return bidders.values();
    }
    
    function getAuctionStatus() external view returns (
        bool isFinalized,
        uint256 currentPriceWei,
        uint256 totalBidders,
        uint256 processedBidders,
        bool isCompleted,
        uint256 tokenScale
    ) {
        return (
            finalized,
            currentPrice(),
            bidders.length(),
            nextBidderToProcess,
            allTokensDistributed,
            scalingFactor
        );
    }
} 