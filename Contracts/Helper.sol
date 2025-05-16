// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @title MockAavePool
 * @dev A simplified mock of Aave's Pool contract for staking/supplying assets
 */
contract MockAavePool {
    mapping(address => mapping(address => uint256)) public userSupplies;
    mapping(address => uint256) public totalSupplies;
    mapping(address => uint256) public interestRates; // APY in basis points (e.g., 500 = 5%)
    address public owner;

    event Supply(address indexed asset, address indexed user, uint256 amount);
    event Withdraw(address indexed asset, address indexed user, uint256 amount);
    event InterestRateSet(address indexed asset, uint256 rate);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    /**
     * @dev Sets the interest rate for an asset
     * @param asset The asset address
     * @param rate The interest rate in basis points (e.g., 500 = 5%)
     */
    function setInterestRate(address asset, uint256 rate) external onlyOwner {
        interestRates[asset] = rate;
        emit InterestRateSet(asset, rate);
    }

    /**
     * @dev Supplies an asset to the pool (exactly matching Aave's function signature)
     * @param asset The address of the asset
     * @param amount The amount to supply
     * @param onBehalfOf The address that will receive the aTokens
     * @param referralCode The referral code, unused in this mock
     */
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external {
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer the tokens from the user to this contract
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        
        // Update the user's supply balance
        userSupplies[asset][onBehalfOf] += amount;
        totalSupplies[asset] += amount;
        
        emit Supply(asset, onBehalfOf, amount);
    }

    /**
     * @dev Withdraws an asset from the pool (exactly matching Aave's function signature)
     * @param asset The address of the asset
     * @param amount The amount to withdraw
     * @param to The address that will receive the underlying asset
     * @return The actual amount withdrawn
     */
    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        // Determine available amount (either amount requested or user's total supply)
        uint256 userSupply = userSupplies[asset][msg.sender];
        uint256 actualAmount = amount > userSupply ? userSupply : amount;
        
        require(actualAmount > 0, "No funds to withdraw");
        
        // Update balances
        userSupplies[asset][msg.sender] -= actualAmount;
        totalSupplies[asset] -= actualAmount;
        
        // Transfer the tokens from this contract to the recipient
        IERC20(asset).transfer(to, actualAmount);
        
        emit Withdraw(asset, to, actualAmount);
        
        return actualAmount;
    }

    /**
     * @dev Returns the total supplied amount of an asset by a user
     * @param asset The asset address
     * @param user The user address
     * @return The supplied amount
     */
    function getUserSupply(address asset, address user) external view returns (uint256) {
        return userSupplies[asset][user];
    }

    /**
     * @dev Returns the total supply of an asset in the pool
     * @param asset The asset address
     * @return The total supply
     */
    function getTotalSupply(address asset) external view returns (uint256) {
        return totalSupplies[asset];
    }
}

/**
 * @title MockSwapRouter
 * @dev A simplified mock of Uniswap's SwapRouter for token swapping
 */
contract MockSwapRouter {
    struct PairRate {
        uint256 numerator;   // Price numerator
        uint256 denominator; // Price denominator
    }
    
    mapping(address => mapping(address => PairRate)) public exchangeRates;
    address public owner;
    
    event RateSet(address indexed tokenA, address indexed tokenB, uint256 numerator, uint256 denominator);
    event Swap(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    /**
     * @dev Sets the exchange rate between two tokens
     * @param tokenA The first token address
     * @param tokenB The second token address
     * @param numerator The price numerator
     * @param denominator The price denominator
     */
    function setExchangeRate(address tokenA, address tokenB, uint256 numerator, uint256 denominator) external onlyOwner {
        require(denominator > 0, "Denominator must be greater than 0");
        
        exchangeRates[tokenA][tokenB] = PairRate(numerator, denominator);
        exchangeRates[tokenB][tokenA] = PairRate(denominator, numerator);
        
        emit RateSet(tokenA, tokenB, numerator, denominator);
    }

    /**
     * @dev Swaps exact tokens for tokens (exactly matching Uniswap's function signature)
     * @param amountIn The amount of input tokens
     * @param amountOutMin The minimum amount of output tokens
     * @param path The swap path (array of token addresses)
     * @param to The recipient address
     * @param deadline The swap deadline, unused in this mock
     * @return amounts The amounts of tokens swapped
     */
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(path.length >= 2, "Invalid path");
        require(amountIn > 0, "Amount must be greater than 0");
        
        // Initialize the amounts array
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        
        // Process each swap in the path
        for (uint256 i = 0; i < path.length - 1; i++) {
            address tokenIn = path[i];
            address tokenOut = path[i + 1];
            
            PairRate memory rate = exchangeRates[tokenIn][tokenOut];
            require(rate.denominator > 0, "Exchange rate not set");
            
            // Calculate the output amount based on the exchange rate
            uint256 amountOut = (amounts[i] * rate.numerator) / rate.denominator;
            amounts[i + 1] = amountOut;
            
            // Transfer input tokens from sender to this contract
            if (i == 0) {
                IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
            }
            
            // Transfer output tokens to recipient if this is the final swap
            if (i == path.length - 2) {
                require(amountOut >= amountOutMin, "Insufficient output amount");
                IERC20(tokenOut).transfer(to, amountOut);
            }
            
            emit Swap(tokenIn, tokenOut, amounts[i], amountOut);
        }
        
        return amounts;
    }

    /**
     * @dev Gets the exchange rate between two tokens
     * @param tokenA The first token address
     * @param tokenB The second token address
     * @return The exchange rate as a tuple (numerator, denominator)
     */
    function getExchangeRate(address tokenA, address tokenB) external view returns (uint256, uint256) {
        PairRate memory rate = exchangeRates[tokenA][tokenB];
        return (rate.numerator, rate.denominator);
    }
}

/**
 * @title MockUSDC
 * @dev A simplified mock of the USDC stablecoin
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private _decimals = 6; // USDC has 6 decimals

    constructor() ERC20("Mock USDC", "USDC") Ownable(msg.sender) {}

    /**
     * @dev Returns the number of decimals used for token
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Mints tokens to the specified address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Convenience function to mint tokens to message sender
     * @param amount The amount of tokens to mint
     */
    function faucet(uint256 amount) external {
        require(amount <= 10000 * (10 ** decimals()), "Faucet limited to 10,000 USDC");
        _mint(msg.sender, amount);
    }
}

/**
 * @title MockCbBTC
 * @dev A simplified mock of the cbBTC (Coinbase Wrapped BTC) token
 */
contract MockCbBTC is ERC20, Ownable {
    uint8 private _decimals = 8; // BTC has 8 decimals

    constructor() ERC20("Mock Coinbase BTC", "cbBTC") Ownable(msg.sender) {}

    /**
     * @dev Returns the number of decimals used for token
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Mints tokens to the specified address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Convenience function to mint tokens to message sender
     * @param amount The amount of tokens to mint
     */
    function faucet(uint256 amount) external {
        require(amount <= 1 * (10 ** decimals()), "Faucet limited to 1 cbBTC");
        _mint(msg.sender, amount);
    }
}

/**
 * @title MockBTCPriceOracle
 * @dev A simplified mock of Chainlink's Price Feed for BTC/USD
 */
contract MockBTCPriceOracle {
    int256 private price;
    uint8 private _decimals = 8;  // Same as Chainlink BTC/USD oracle
    string private _description = "Mock BTC / USD";
    uint256 private _version = 1;
    
    address public owner;
    
    event PriceUpdated(int256 price);

    constructor(int256 initialPrice) {
        price = initialPrice;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    /**
     * @dev Updates the price of BTC in USD
     * @param newPrice The new price
     */
    function updatePrice(int256 newPrice) external onlyOwner {
        price = newPrice;
        emit PriceUpdated(newPrice);
    }

    /**
     * @dev Returns the latest round data (matching Chainlink's function signature)
     * @return roundId The round ID
     * @return answer The price
     * @return startedAt The timestamp when the round started
     * @return updatedAt The timestamp when the round was updated
     * @return answeredInRound The round ID in which the answer was computed
     */
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (
            uint80(block.number),  // Use block number as round ID
            price,
            block.timestamp - 1 hours,  // Started 1 hour ago
            block.timestamp,  // Updated now
            uint80(block.number)
        );
    }

    /**
     * @dev Returns the decimals of the price feed
     * @return The number of decimals
     */
    function decimals() external view returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Returns the description of the price feed
     * @return The description
     */
    function description() external view returns (string memory) {
        return _description;
    }

    /**
     * @dev Returns the version of the price feed
     * @return The version
     */
    function version() external view returns (uint256) {
        return _version;
    }
}

/**
 * @title MockDeployer
 * @dev Contract to deploy and configure all mock contracts for the LendingPool
 */
contract MockDeployer {
    // Deployed contract addresses
    MockUSDC public usdc;
    MockCbBTC public cbBtc;
    MockAavePool public aavePool;
    MockSwapRouter public swapRouter;
    MockBTCPriceOracle public priceOracle;
    
    // Constants
    uint256 public constant BTC_USD_PRICE = 103000e8; // $103,000 with 8 decimals
    uint256 public constant INITIAL_USDC_LIQUIDITY = 25000000e6; // 25 million USDC
    uint256 public constant INITIAL_BTC_LIQUIDITY = 250e8; // 250 BTC
    
    // Events
    event Deployed(
        address usdc,
        address cbBtc,
        address aavePool,
        address swapRouter,
        address priceOracle
    );
    
    event Initialized(
        uint256 usdcLiquidity,
        uint256 btcLiquidity,
        uint256 btcUsdRate
    );
    
    /**
     * @dev Deploys all mock contracts
     */
    function deploy() external {
        // Deploy tokens
        usdc = new MockUSDC();
        cbBtc = new MockCbBTC();
        
        // Deploy infrastructure
        aavePool = new MockAavePool();
        swapRouter = new MockSwapRouter();
        priceOracle = new MockBTCPriceOracle(int256(BTC_USD_PRICE));
        
        emit Deployed(
            address(usdc),
            address(cbBtc),
            address(aavePool),
            address(swapRouter),
            address(priceOracle)
        );
    }
    
    /**
     * @dev Initializes all contracts with required settings and liquidity
     */
    function initialize() external {
        require(address(usdc) != address(0), "Deploy contracts first");
        
        // Mint initial tokens for liquidity
        usdc.mint(address(this), INITIAL_USDC_LIQUIDITY);
        cbBtc.mint(address(this), INITIAL_BTC_LIQUIDITY);
        
        // Set exchange rate in swap router (USDC:cbBTC = 103000:1)
        usdc.approve(address(swapRouter), INITIAL_USDC_LIQUIDITY);
        cbBtc.approve(address(swapRouter), INITIAL_BTC_LIQUIDITY);
        
        // Set exchange rate - 1 BTC = 103,000 USDC
        // For price precision, we use the ratio based on smallest units
        // usdc (6 decimals) to cbBtc (8 decimals)
        // 103000 * 10^6 : 1 * 10^8
        swapRouter.setExchangeRate(
            address(usdc),
            address(cbBtc),
            103000 * 10**6, // numerator (USDC)
            1 * 10**8       // denominator (cbBTC)
        );
        
        // Add initial liquidity by transferring tokens to the router
        usdc.transfer(address(swapRouter), INITIAL_USDC_LIQUIDITY);
        cbBtc.transfer(address(swapRouter), INITIAL_BTC_LIQUIDITY);
        
        // Set Aave interest rates - 5% for cbBTC
        aavePool.setInterestRate(address(cbBtc), 500); // 5% = 500 basis points
        
        emit Initialized(
            INITIAL_USDC_LIQUIDITY,
            INITIAL_BTC_LIQUIDITY,
            BTC_USD_PRICE
        );
    }
    
    /**
     * @dev Mints test tokens for a user
     * @param user Address to receive tokens
     * @param usdcAmount Amount of USDC to mint
     * @param btcAmount Amount of cbBTC to mint
     */
    function mintTestTokens(address user, uint256 usdcAmount, uint256 btcAmount) external {
        require(address(usdc) != address(0), "Deploy contracts first");
        
        if (usdcAmount > 0) {
            usdc.mint(user, usdcAmount);
        }
        
        if (btcAmount > 0) {
            cbBtc.mint(user, btcAmount);
        }
    }
    
    /**
     * @dev Updates the BTC price in the oracle
     * @param newPrice New BTC price in USD (with 8 decimals)
     */
    function updateBtcPrice(int256 newPrice) external {
        require(address(priceOracle) != address(0), "Deploy contracts first");
        priceOracle.updatePrice(newPrice);
    }
    
    /**
     * @dev Returns the addresses of all deployed contracts
     */
    function getAddresses() external view returns (
        address usdcAddress,
        address cbBtcAddress,
        address aavePoolAddress,
        address swapRouterAddress,
        address priceOracleAddress
    ) {
        return (
            address(usdc),
            address(cbBtc),
            address(aavePool),
            address(swapRouter),
            address(priceOracle)
        );
    }
}
