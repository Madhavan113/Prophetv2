// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@thirdweb-dev/contracts/base/ERC20Base.sol";
import "@thirdweb-dev/contracts/extension/Permissions.sol";
import "./ProphetToken.sol";

/**
 * @title ArtistToken
 * @dev ERC20 token representing an artist, with intrinsic value tied to Prophet tokens
 */
contract ArtistToken is ERC20Base, Permissions {
    // Role for bonding curve contract
    bytes32 public constant BONDING_CURVE_ROLE = keccak256("BONDING_CURVE_ROLE");
    // Events
    event ProphetValueUpdated(uint256 previousValue, uint256 newValue);
    
    // State variables
    ProphetToken public prophetToken;
    string public artistName;
    string public artistInfo;
    
    /**
     * @dev Constructor for the Artist token
     * @param _name Name of the token
     * @param _symbol Symbol of the token
     * @param _primarySaleRecipient Address to receive sales
     * @param _artistName Name of the artist
     * @param _artistInfo Additional info about the artist
     * @param _prophetTokenAddress Address of the Prophet token contract
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _primarySaleRecipient,
        string memory _artistName,
        string memory _artistInfo,
        address _prophetTokenAddress
    )
        ERC20Base(
            _primarySaleRecipient,
            _name,
            _symbol
        )
    {
        artistName = _artistName;
        artistInfo = _artistInfo;
        prophetToken = ProphetToken(_prophetTokenAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        // Register this token with the Prophet contract
        // This will fail if the caller doesn't have admin rights on Prophet contract
        // In production, this should be done separately by the Prophet admin
    }
        
    /**
     * @dev Update artist information
     * @param _artistInfo New artist information
     */
    function updateArtistInfo(string memory _artistInfo) external onlyRole(DEFAULT_ADMIN_ROLE) {
        artistInfo = _artistInfo;
    }
    
    /**
     * @dev Get the current Prophet value for this artist token
     * @return The Prophet value for this token
     */
    function getProphetValue() external view returns (uint256) {
        return prophetToken.getArtistTokenProphetValue(address(this));
    }
    
    /**
     * @dev Request registration with the Prophet token (must be called by an admin of the Prophet token)
     * @param initialProphetValue The initial Prophet value to set
     */
    function requestProphetRegistration(uint256 initialProphetValue) external {
        // This function should be called by someone with admin rights on the Prophet contract
        prophetToken.registerArtistToken(address(this), artistName, initialProphetValue);
    }
    
    /**
     * @dev Mint tokens to an address (only callable by bonding curve or admin)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external {
        require(
            hasRole(BONDING_CURVE_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized to mint"
        );
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens from an address with allowance (only callable by bonding curve or admin)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address from, uint256 amount) external override {
        require(
            hasRole(BONDING_CURVE_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized to burn"
        );
        
        // Check allowance if not burning own tokens and not admin
        if (from != msg.sender && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            uint256 currentAllowance = allowance(from, msg.sender);
            require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
            _approve(from, msg.sender, currentAllowance - amount);
        }
        
        _burn(from, amount);
    }
    
    /**
     * @dev Grant bonding curve role to an address (only admin)
     * @param bondingCurve Address of the bonding curve contract
     */
    function setBondingCurve(address bondingCurve) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(BONDING_CURVE_ROLE, bondingCurve);
    }
} 