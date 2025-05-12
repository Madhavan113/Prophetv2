// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@thirdweb-dev/contracts/extension/Permissions.sol";
import "./ArtistToken.sol";
import "./ProphetToken.sol";

/**
 * @title ArtistTokenFactory
 * @dev Factory contract to create new artist tokens linked to the Prophet ecosystem
 */
contract ArtistTokenFactory is Permissions {
    // Events
    event ArtistTokenCreated(address indexed artistTokenAddress, string artistName, address creator);
    
    // State variables
    ProphetToken public prophetToken;
    address[] public createdArtistTokens;
    
    /**
     * @dev Constructor for the factory
     * @param _prophetTokenAddress Address of the Prophet token
     */
    constructor(address _prophetTokenAddress) {
        prophetToken = ProphetToken(_prophetTokenAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Create a new artist token
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
} 