// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@thirdweb-dev/contracts/extension/Permissions.sol";
import "./ArtistToken.sol";

// Interface for ProphetToken functions we need
interface IProphetToken {
    function hasRole(bytes32 role, address account) external view returns (bool);
    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);
    function registerArtistToken(address artistTokenAddress, string memory artistName, uint256 initialProphetValue) external;
}

// Interface for BondingCurve functions we need
interface IBondingCurve {
    function hasRole(bytes32 role, address account) external view returns (bool);
    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);
    function initializeCurve(address artistToken, uint256 coefficient, uint256 exponent) external;
}

/**
 * @title ArtistTokenFactory
 * @dev Factory contract to create new artist tokens linked to the Prophet ecosystem
 */
contract ArtistTokenFactory is Permissions {
    // Events
    event ArtistTokenCreated(address indexed artistTokenAddress, string artistName, address creator);
    
    // State variables
    IProphetToken public prophetToken;
    IBondingCurve public bondingCurve;
    address[] public createdArtistTokens;
    
    // Default curve parameters
    uint256 public defaultCoefficient = 1e15; // 0.001 Prophet tokens (scaled by 1e18)
    uint256 public defaultExponent = 2e18;    // k=2 (quadratic curve, scaled by 1e18)
    
    /**
     * @dev Constructor for the factory
     * @param _prophetTokenAddress Address of the Prophet token
     * @param _bondingCurveAddress Address of the bonding curve contract
     */
    constructor(address _prophetTokenAddress, address _bondingCurveAddress) {
        prophetToken = IProphetToken(_prophetTokenAddress);
        bondingCurve = IBondingCurve(_bondingCurveAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Create a new artist token with default curve parameters
     * @param name Token name
     * @param symbol Token symbol
     * @param primarySaleRecipient Address to receive proceeds from token sales
     * @param artistName Name of the artist
     * @param artistInfo Additional information about the artist
     * @param initialProphetValue Initial Prophet value for this artist
     * @return The address of the newly created artist token
     */
    function createArtistToken(
        string memory name,
        string memory symbol,
        address primarySaleRecipient,
        string memory artistName,
        string memory artistInfo,
        uint256 initialProphetValue
    ) external returns (address) {
        return createArtistTokenWithCurve(
            name,
            symbol,
            primarySaleRecipient,
            artistName,
            artistInfo,
            initialProphetValue,
            defaultCoefficient,
            defaultExponent
        );
    }
    
    /**
     * @dev Create a new artist token with custom curve parameters
     * @param name Token name
     * @param symbol Token symbol
     * @param primarySaleRecipient Address to receive proceeds from token sales
     * @param artistName Name of the artist
     * @param artistInfo Additional information about the artist
     * @param initialProphetValue Initial Prophet value for this artist
     * @param coefficient Bonding curve coefficient (scaled by 1e18)
     * @param exponent Bonding curve exponent (scaled by 1e18)
     * @return The address of the newly created artist token
     */
    function createArtistTokenWithCurve(
        string memory name,
        string memory symbol,
        address primarySaleRecipient,
        string memory artistName,
        string memory artistInfo,
        uint256 initialProphetValue,
        uint256 coefficient,
        uint256 exponent
    ) public returns (address) {
        // Create a new artist token
        ArtistToken newArtistToken = new ArtistToken(
            name,
            symbol,
            primarySaleRecipient,
            artistName,
            artistInfo,
            address(prophetToken)
        );
        
        // Store the new token address
        address artistTokenAddress = address(newArtistToken);
        createdArtistTokens.push(artistTokenAddress);
        
        // Register the token with the Prophet contract if the caller has admin rights
        if (prophetToken.hasRole(prophetToken.DEFAULT_ADMIN_ROLE(), msg.sender)) {
            prophetToken.registerArtistToken(artistTokenAddress, artistName, initialProphetValue);
        }
        
        // Initialize bonding curve parameters if the factory has admin rights on the bonding curve
        if (bondingCurve.hasRole(bondingCurve.DEFAULT_ADMIN_ROLE(), address(this))) {
            bondingCurve.initializeCurve(artistTokenAddress, coefficient, exponent);
        }
        
        // Set up bonding curve role for the new token
        newArtistToken.setBondingCurve(address(bondingCurve));
        
        // Transfer ownership to the caller
        newArtistToken.grantRole(newArtistToken.DEFAULT_ADMIN_ROLE(), msg.sender);
        
        // If the factory is not the msg.sender, we should revoke our role
        if (msg.sender != address(this)) {
            newArtistToken.revokeRole(newArtistToken.DEFAULT_ADMIN_ROLE(), address(this));
        }
        
        emit ArtistTokenCreated(artistTokenAddress, artistName, msg.sender);
        
        return artistTokenAddress;
    }
    
    /**
     * @dev Get all created artist tokens
     * @return Array of all artist token addresses created by this factory
     */
    function getAllArtistTokens() external view returns (address[] memory) {
        return createdArtistTokens;
    }
    
    /**
     * @dev Get the total number of created artist tokens
     * @return Number of artist tokens created
     */
    function getArtistTokenCount() external view returns (uint256) {
        return createdArtistTokens.length;
    }
    
    /**
     * @dev Set default curve parameters (only admin)
     * @param coefficient New default coefficient
     * @param exponent New default exponent
     */
    function setDefaultCurveParameters(
        uint256 coefficient,
        uint256 exponent
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(coefficient >= 1e12, "Coefficient too small");
        require(exponent > 0 && exponent <= 10e18, "Invalid exponent");
        
        defaultCoefficient = coefficient;
        defaultExponent = exponent;
    }
} 