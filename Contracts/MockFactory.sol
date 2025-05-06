// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MockPair.sol";

contract MockFactory {
    mapping(address => mapping(address => address)) public getPair;

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "Identical addresses");
        require(getPair[tokenA][tokenB] == address(0), "Pair already exists");

        // Deploy new pair contract
        MockPair newPair = new MockPair(tokenA, tokenB);
        pair = address(newPair);

        getPair[tokenA][tokenB] = pair;
        getPair[tokenB][tokenA] = pair; // Both directions
    }
}
