// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@thirdweb-dev/contracts/base/ERC20Base.sol";
import "@thirdweb-dev/contracts/extension/Permissions.sol";

contract ProphetToken is ERC20Base, Permissions {
    // Demo pricing config
    uint256 public ethUsdRate = 3000 * 1e18; // Simulate: 1 ETH = $3000
    uint256 public usdTokenPrice = 1e16;     // $0.01 per token (in 18-decimal USD)

    bool public saleActive = true;

    constructor(
        string memory _name,
        string memory _symbol,
        address _primarySaleRecipient
    )
        ERC20Base(_primarySaleRecipient, _name, _symbol)
    {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function buyTokens(uint256 quantity) external payable {
        require(saleActive, "Token sale is not active");
        require(quantity > 0, "Amount must be greater than 0");

        uint256 costInEth = (quantity * usdTokenPrice * 1e18) / ethUsdRate;
        require(msg.value >= costInEth, "Insufficient ETH sent");

        _mint(msg.sender, quantity);

        if (msg.value > costInEth) {
            payable(msg.sender).transfer(msg.value - costInEth);
        }
    }

    function claim(address to, uint256 quantity) external payable {
        require(saleActive, "Token sale is not active");
        require(quantity > 0, "Quantity must be greater than 0");

        uint256 costInEth = (quantity * usdTokenPrice * 1e18) / ethUsdRate;
        require(msg.value >= costInEth, "Insufficient ETH sent");

        _mint(to, quantity);

        if (msg.value > costInEth) {
            payable(msg.sender).transfer(msg.value - costInEth);
        }
    }

    function setUsdTokenPrice(uint256 newUsdPrice) external onlyRole(DEFAULT_ADMIN_ROLE) {
        usdTokenPrice = newUsdPrice;
    }

    function setEthUsdRate(uint256 newRate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        ethUsdRate = newRate;
    }

    function toggleSale() external onlyRole(DEFAULT_ADMIN_ROLE) {
        saleActive = !saleActive;
    }

    function withdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(msg.sender).transfer(balance);
    }

    function getTokenPriceInEth() external view returns (uint256) {
        return (usdTokenPrice * 1e18) / ethUsdRate;
    }

    function calculateCost(uint256 tokenAmount) external view returns (uint256) {
        return (tokenAmount * usdTokenPrice * 1e18) / ethUsdRate;
    }
}
