// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title CrossFI Swap Contract
 * @dev AMM-style swap contract for tUSDC <-> XFI swaps
 * Uses constant product formula (x * y = k) for price calculation
 */
contract CrossFISwap is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant MINIMUM_LIQUIDITY = 10**3;
    uint256 public constant FEE_DENOMINATOR = 10000; // 0.3% = 30/10000
    uint256 public constant SWAP_FEE = 30; // 0.3% fee

    // State variables
    IERC20 public immutable tUSDC;
    uint256 public reserveXFI;
    uint256 public reserveTUSDC;
    uint256 public totalLiquidity;
    
    mapping(address => uint256) public liquidityBalance;
    
    // Events
    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );
    
    event LiquidityAdded(
        address indexed provider,
        uint256 xfiAmount,
        uint256 tusdcAmount,
        uint256 liquidity
    );
    
    event LiquidityRemoved(
        address indexed provider,
        uint256 xfiAmount,
        uint256 tusdcAmount,
        uint256 liquidity
    );
    
    event PriceUpdate(uint256 newXFIPrice, uint256 timestamp);

    // Custom errors
    error InsufficientLiquidity();
    error InsufficientInputAmount();
    error InsufficientOutputAmount();
    error ExcessiveSlippage();
    error InvalidTokenAddress();
    error TransferFailed();

    constructor(address _tUSDC) {
        if (_tUSDC == address(0)) revert InvalidTokenAddress();
        tUSDC = IERC20(_tUSDC);
    }

    /**
     * @dev Add liquidity to the pool
     * @param tusdcAmount Amount of tUSDC to add
     * @param minXFI Minimum XFI amount (slippage protection)
     * @param minTUSDC Minimum tUSDC amount (slippage protection)
     */
    function addLiquidity(
        uint256 tusdcAmount,
        uint256 minXFI,
        uint256 minTUSDC
    ) external payable nonReentrant whenNotPaused {
        if (msg.value == 0 || tusdcAmount == 0) revert InsufficientInputAmount();
        
        uint256 xfiAmount = msg.value;
        uint256 liquidity;
        
        if (totalLiquidity == 0) {
            // First liquidity provision
            liquidity = sqrt(xfiAmount * tusdcAmount) - MINIMUM_LIQUIDITY;
            if (liquidity <= 0) revert InsufficientLiquidity();
            
            reserveXFI = xfiAmount;
            reserveTUSDC = tusdcAmount;
        } else {
            // Calculate optimal amounts based on current reserves
            uint256 optimalTUSDC = (xfiAmount * reserveTUSDC) / reserveXFI;
            uint256 optimalXFI = (tusdcAmount * reserveXFI) / reserveTUSDC;
            
            if (optimalTUSDC <= tusdcAmount) {
                if (optimalTUSDC < minTUSDC) revert ExcessiveSlippage();
                tusdcAmount = optimalTUSDC;
            } else {
                if (optimalXFI < minXFI) revert ExcessiveSlippage();
                xfiAmount = optimalXFI;
                
                // Refund excess XFI
                if (msg.value > xfiAmount) {
                    (bool success, ) = msg.sender.call{value: msg.value - xfiAmount}("");
                    if (!success) revert TransferFailed();
                }
            }
            
            liquidity = min(
                (xfiAmount * totalLiquidity) / reserveXFI,
                (tusdcAmount * totalLiquidity) / reserveTUSDC
            );
            
            reserveXFI += xfiAmount;
            reserveTUSDC += tusdcAmount;
        }
        
        totalLiquidity += liquidity;
        liquidityBalance[msg.sender] += liquidity;
        
        // Transfer tUSDC from user
        tUSDC.safeTransferFrom(msg.sender, address(this), tusdcAmount);
        
        emit LiquidityAdded(msg.sender, xfiAmount, tusdcAmount, liquidity);
    }

    /**
     * @dev Remove liquidity from the pool
     * @param liquidity Amount of liquidity tokens to burn
     * @param minXFI Minimum XFI to receive
     * @param minTUSDC Minimum tUSDC to receive
     */
    function removeLiquidity(
        uint256 liquidity,
        uint256 minXFI,
        uint256 minTUSDC
    ) external nonReentrant {
        if (liquidity == 0) revert InsufficientInputAmount();
        if (liquidityBalance[msg.sender] < liquidity) revert InsufficientLiquidity();
        
        uint256 xfiAmount = (liquidity * reserveXFI) / totalLiquidity;
        uint256 tusdcAmount = (liquidity * reserveTUSDC) / totalLiquidity;
        
        if (xfiAmount < minXFI || tusdcAmount < minTUSDC) {
            revert ExcessiveSlippage();
        }
        
        liquidityBalance[msg.sender] -= liquidity;
        totalLiquidity -= liquidity;
        reserveXFI -= xfiAmount;
        reserveTUSDC -= tusdcAmount;
        
        // Transfer tokens to user
        tUSDC.safeTransfer(msg.sender, tusdcAmount);
        (bool success, ) = msg.sender.call{value: xfiAmount}("");
        if (!success) revert TransferFailed();
        
        emit LiquidityRemoved(msg.sender, xfiAmount, tusdcAmount, liquidity);
    }

    /**
     * @dev Swap XFI for tUSDC
     * @param minTUSDCOut Minimum tUSDC to receive (slippage protection)
     */
    function swapXFIForTUSDC(uint256 minTUSDCOut) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
    {
        if (msg.value == 0) revert InsufficientInputAmount();
        
        uint256 tusdcOut = getAmountOut(msg.value, reserveXFI, reserveTUSDC);
        if (tusdcOut < minTUSDCOut) revert ExcessiveSlippage();
        
        uint256 fee = (msg.value * SWAP_FEE) / FEE_DENOMINATOR;
        uint256 amountInAfterFee = msg.value - fee;
        
        reserveXFI += amountInAfterFee;
        reserveTUSDC -= tusdcOut;
        
        tUSDC.safeTransfer(msg.sender, tusdcOut);
        
        emit Swap(msg.sender, address(0), address(tUSDC), msg.value, tusdcOut, fee);
        emit PriceUpdate(getCurrentXFIPrice(), block.timestamp);
    }

    /**
     * @dev Swap tUSDC for XFI
     * @param tusdcIn Amount of tUSDC to swap
     * @param minXFIOut Minimum XFI to receive (slippage protection)
     */
    function swapTUSDCForXFI(uint256 tusdcIn, uint256 minXFIOut) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        if (tusdcIn == 0) revert InsufficientInputAmount();
        
        uint256 xfiOut = getAmountOut(tusdcIn, reserveTUSDC, reserveXFI);
        if (xfiOut < minXFIOut) revert ExcessiveSlippage();
        
        uint256 fee = (tusdcIn * SWAP_FEE) / FEE_DENOMINATOR;
        uint256 amountInAfterFee = tusdcIn - fee;
        
        reserveTUSDC += amountInAfterFee;
        reserveXFI -= xfiOut;
        
        tUSDC.safeTransferFrom(msg.sender, address(this), tusdcIn);
        (bool success, ) = msg.sender.call{value: xfiOut}("");
        if (!success) revert TransferFailed();
        
        emit Swap(msg.sender, address(tUSDC), address(0), tusdcIn, xfiOut, fee);
        emit PriceUpdate(getCurrentXFIPrice(), block.timestamp);
    }

    /**
     * @dev Calculate output amount for a swap (constant product formula)
     * @param amountIn Input amount
     * @param reserveIn Input token reserve
     * @param reserveOut Output token reserve
     * @return amountOut Output amount
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        if (reserveIn == 0 || reserveOut == 0) return 0;
        
        uint256 amountInAfterFee = (amountIn * (FEE_DENOMINATOR - SWAP_FEE)) / FEE_DENOMINATOR;
        uint256 numerator = amountInAfterFee * reserveOut;
        uint256 denominator = reserveIn + amountInAfterFee;
        amountOut = numerator / denominator;
    }

    /**
     * @dev Get current XFI price in tUSDC (price per 1 XFI)
     * @return price XFI price in tUSDC (scaled by 1e18)
     */
    function getCurrentXFIPrice() public view returns (uint256 price) {
        if (reserveXFI == 0) return 0;
        price = (reserveTUSDC * 1e18) / reserveXFI;
    }

    /**
     * @dev Get current tUSDC price in XFI (price per 1 tUSDC)
     * @return price tUSDC price in XFI (scaled by 1e18)
     */
    function getCurrentTUSDCPrice() public view returns (uint256 price) {
        if (reserveTUSDC == 0) return 0;
        price = (reserveXFI * 1e18) / reserveTUSDC;
    }

    /**
     * @dev Get pool reserves
     * @return xfiReserve XFI reserve amount
     * @return tusdcReserve tUSDC reserve amount
     */
    function getReserves() external view returns (uint256 xfiReserve, uint256 tusdcReserve) {
        return (reserveXFI, reserveTUSDC);
    }

    /**
     * @dev Calculate how much XFI is needed for a specific tUSDC output
     */
    function getXFIAmountIn(uint256 tusdcOut) external view returns (uint256 xfiIn) {
        if (tusdcOut >= reserveTUSDC) return type(uint256).max;
        
        uint256 numerator = reserveXFI * tusdcOut * FEE_DENOMINATOR;
        uint256 denominator = (reserveTUSDC - tusdcOut) * (FEE_DENOMINATOR - SWAP_FEE);
        xfiIn = (numerator / denominator) + 1;
    }

    /**
     * @dev Calculate how much tUSDC is needed for a specific XFI output
     */
    function getTUSDCAmountIn(uint256 xfiOut) external view returns (uint256 tusdcIn) {
        if (xfiOut >= reserveXFI) return type(uint256).max;
        
        uint256 numerator = reserveTUSDC * xfiOut * FEE_DENOMINATOR;
        uint256 denominator = (reserveXFI - xfiOut) * (FEE_DENOMINATOR - SWAP_FEE);
        tusdcIn = (numerator / denominator) + 1;
    }

    // Admin functions
    
    /**
     * @dev Emergency pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Withdraw accumulated fees (only owner)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > reserveXFI) {
            uint256 fees = balance - reserveXFI;
            (bool success, ) = owner().call{value: fees}("");
            if (!success) revert TransferFailed();
        }
    }

    // Utility functions
    
    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    // Allow contract to receive XFI
    receive() external payable {
        // Only allow adding XFI through specific functions
        require(msg.sender == address(this), "Use addLiquidity or swap functions");
    }
} 