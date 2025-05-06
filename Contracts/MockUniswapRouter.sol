// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./MockPair.sol";
import "./MockFactory.sol";

contract MockRouter {
    address public factory;

    constructor(address _factory) {
        factory = _factory;
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired
    ) external {
        address pairAddress = MockFactory(factory).getPair(tokenA, tokenB);
        require(pairAddress != address(0), "Pair does not exist");

        MockPair pair = MockPair(pairAddress);

        // Approve tokens for the pair contract
        IERC20(tokenA).transferFrom(msg.sender, address(pair), amountADesired);
        IERC20(tokenB).transferFrom(msg.sender, address(pair), amountBDesired);

        // Call addLiquidity on the pair contract
        pair.addLiquidity(amountADesired, amountBDesired);
    }
}
