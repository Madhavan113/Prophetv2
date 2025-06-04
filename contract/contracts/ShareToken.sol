// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ShareToken
 * @dev Fixed-supply ERC20 token for artist shares, mints total supply to itself on deployment.
 * Supports custom decimals to allow for different token precision requirements.
 */
contract ShareToken is ERC20, Ownable {
    uint256 public immutable TOTAL_SUPPLY;
    uint8 private immutable _decimals;

    /**
     * @dev Constructor for ShareToken
     * @param name_ Name of the token
     * @param symbol_ Symbol of the token
     * @param totalSupply_ Total supply to mint (in token units based on decimals)
     * @param decimals_ Number of decimals for the token (default is 18 if not specified)
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        uint8 decimals_
    ) ERC20(name_, symbol_) {
        TOTAL_SUPPLY = totalSupply_;
        _decimals = decimals_;
        _mint(address(this), totalSupply_);
    }

    /**
     * @dev Constructor overload with default 18 decimals for backward compatibility
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_
    ) ERC20(name_, symbol_) {
        TOTAL_SUPPLY = totalSupply_;
        _decimals = 18; // Default to 18 decimals
        _mint(address(this), totalSupply_);
    }
    
    /**
     * @dev Override decimals function to return custom decimal value
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Allow the owner (factory or auction) to transfer tokens out.
     * @param to Recipient address
     * @param amount Amount to transfer
     */
    function transferOut(address to, uint256 amount) external onlyOwner {
        _transfer(address(this), to, amount);
    }
} 