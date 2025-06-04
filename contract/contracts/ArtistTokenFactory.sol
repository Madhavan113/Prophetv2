// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ShareToken.sol";
import "./DutchAuction.sol";

/**
 * @title ArtistTokenFactory
 * @dev Factory contract for deploying ShareToken and DutchAuction for artists
 */
contract ArtistTokenFactory is Ownable {
    event ShareTokenAndAuctionCreated(
        address indexed shareToken,
        address indexed auction,
        address indexed artist,
        string name,
        string symbol,
        uint256 totalSupply,
        uint256 startPrice,
        uint256 floorPrice,
        uint256 duration,
        uint8 decimals
    );

    /**
     * @dev Creates a new ShareToken and DutchAuction for an artist
     * @param name The name of the token
     * @param symbol The symbol of the token
     * @param totalSupply The total supply of the token (in token units based on decimals)
     * @param startPrice The starting price for the auction (in wei)
     * @param floorPrice The floor price for the auction (in wei)
     * @param duration The duration of the auction in seconds
     * @param decimals The number of decimals for the token (default is 18)
     * @return shareTokenAddr The address of the deployed ShareToken
     * @return auctionAddr The address of the deployed DutchAuction
     */
    function createShareTokenAndAuction(
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        uint256 startPrice,
        uint256 floorPrice,
        uint256 duration,
        uint8 decimals
    ) external onlyOwner returns (address shareTokenAddr, address auctionAddr) {
        // Validation checks
        require(totalSupply > 0, "zero supply");
        require(duration > 0, "zero duration");
        require(floorPrice < startPrice, "floor>=start");
        require(decimals <= 18, "decimals too high");

        // Deploy ShareToken with custom decimals
        ShareToken shareToken = new ShareToken(name, symbol, totalSupply, decimals);

        // Deploy DutchAuction
        DutchAuction auction = new DutchAuction(
            address(shareToken),
            msg.sender,
            totalSupply,
            startPrice,
            floorPrice,
            duration
        );

        // First transfer tokens, then ownership - correct ordering
        shareToken.transferOut(address(auction), totalSupply);
        shareToken.transferOwnership(address(auction));

        emit ShareTokenAndAuctionCreated(
            address(shareToken),
            address(auction),
            msg.sender,
            name,
            symbol,
            totalSupply,
            startPrice,
            floorPrice,
            duration,
            decimals
        );

        return (address(shareToken), address(auction));
    }

    /**
     * @dev Creates a new ShareToken and DutchAuction for an artist with default 18 decimals
     * @param name The name of the token
     * @param symbol The symbol of the token
     * @param totalSupply The total supply of the token (in wei, 18 decimals)
     * @param startPrice The starting price for the auction (in wei)
     * @param floorPrice The floor price for the auction (in wei)
     * @param duration The duration of the auction in seconds
     * @return shareTokenAddr The address of the deployed ShareToken
     * @return auctionAddr The address of the deployed DutchAuction
     */
    function createShareTokenAndAuction(
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        uint256 startPrice,
        uint256 floorPrice,
        uint256 duration
    ) external onlyOwner returns (address shareTokenAddr, address auctionAddr) {
        return createShareTokenAndAuction(
            name,
            symbol,
            totalSupply,
            startPrice,
            floorPrice,
            duration,
            18 // Default to 18 decimals
        );
    }
} 