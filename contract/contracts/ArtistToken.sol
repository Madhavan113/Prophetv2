// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ArtistToken
 * @dev Standard ERC20 token for artists, no bonding curve, no ProphetToken logic.
 */
contract ArtistToken is ERC20, AccessControl {
    string public artistName;
    string public artistInfo;

    /**
     * @dev Constructor for the Artist token
     * @param _name Name of the token
     * @param _symbol Symbol of the token
     * @param _artistName Name of the artist
     * @param _artistInfo Additional info about the artist
     * @param admin Address that will have admin role
     */
    constructor(
        string memory _name,
        string memory _symbol,
        string memory _artistName,
        string memory _artistInfo,
        address admin
    ) ERC20(_name, _symbol) {
        artistName = _artistName;
        artistInfo = _artistInfo;
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @dev Update artist information
     * @param _artistInfo New artist information
     */
    function updateArtistInfo(string memory _artistInfo) external onlyRole(DEFAULT_ADMIN_ROLE) {
        artistInfo = _artistInfo;
    }
} 