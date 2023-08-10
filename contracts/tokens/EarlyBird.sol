// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "interfaces/ISoulBoundTokenCollection.sol";

contract EarlyBird is ISoulBoundTokenCollection, Ownable {
    string public constant name = "Early bird";
    string public constant description = "Issued for early WB Network users";

    uint96 private constant TOKEN_ID = 1;
    bytes4 private constant IERC165_ID = type(IERC165).interfaceId;
    bytes4 private constant ISOUL_BOUND_TOKEN_COLLECTION_ID = type(ISoulBoundTokenCollection).interfaceId;

    string private tokenUri;

    constructor(string memory _tokenUri) {
        tokenUri = _tokenUri;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == IERC165_ID || interfaceId == ISOUL_BOUND_TOKEN_COLLECTION_ID;
    }

    function tokenIdsCount() external pure returns (uint96) {
        return 1;
    }

    function tokenIdAtIndex(uint96 index) external pure returns (uint96) {
        require(index == 0, "EarlyBird: out of bounds");
        return TOKEN_ID;
    }

    function tokenURI(uint96 tokenId) external view returns (string memory) {
        require(tokenId == TOKEN_ID, "EarlyBird: token does not exist");
        return tokenUri;
    }

    function assertIsBindable(address operator, uint256, uint96 tokenId) external view {
        require(operator == owner(), "EarlyBird: permission denied");
        require(tokenId == TOKEN_ID, "EarlyBird: token does not exist");
    }
}
