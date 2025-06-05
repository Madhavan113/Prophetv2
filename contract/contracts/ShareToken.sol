// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ShareToken
 * @dev Fixed-supply ERC-20 whose entire supply is minted to itself on deployment.
 */
contract ShareToken is ERC20, Ownable {
    uint256 public immutable TOTAL_SUPPLY;
    uint8   private immutable _decimals;

    /**
     * @param name_        Token name
     * @param symbol_      Token symbol
     * @param totalSupply_ Total supply in token-units (incl. decimals)
     * @param decimals_    Number of decimals (set 18 for typical ERC-20)
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        uint8   decimals_          // pass 18 for the usual case
    ) ERC20(name_, symbol_) {
        require(decimals_ > 0 && decimals_ <= 18, "decimals out of range");

        TOTAL_SUPPLY = totalSupply_;
        _decimals    = decimals_;
        _mint(address(this), totalSupply_);
    }

    /// @notice Return custom decimals
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /// @notice Owner (factory / auction) can move tokens out of the contract
    function transferOut(address to, uint256 amount) external onlyOwner {
        _transfer(address(this), to, amount);
    }
}