// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import "./IUniswapV3.sol";
import "./Brokerbot.sol";
import "./PaymentHub.sol";
import "./BrokerbotRegistry.sol";
import "../ERC20/ERC20Flaggable.sol";
import '../utils/Path.sol';

/**
 * @title Brokerbot Swap Router
 * @author Bernhard Ruf, bernhard@aktionariat.com 
 */ 
contract BrokerbotRouter is ISwapRouter {
	using Path for bytes;

  BrokerbotRegistry public immutable brokerbotRegistry;
	struct PaymentParams {
		IBrokerbot brokerbot;
		PaymentHub paymentHub;
		address baseToken;
		address shareToken;
		uint256 baseAmount;
		bytes path;
		bool hasMultiPools;
	}

	error Brokerbot_Swap_Failed();
	error Brokerbot_Deadline_Reached();
	error Brokerbot_Not_Found();

	constructor(BrokerbotRegistry _registry) {
		brokerbotRegistry = _registry;
	}

	modifier checkDeadline(uint256 deadline) {
		if (deadline < block.timestamp) revert Brokerbot_Deadline_Reached();
    _;
  }

	/**
	 * @notice Buy share tokens with base currency.
	 * @param params Params struct for swap. See @ISwapRouter for struct definition.
	 */
	function exactOutputSingle(
		ExactOutputSingleParams calldata params
	) external payable override checkDeadline(params.deadline) returns (uint256 amountIn) {
		(IBrokerbot brokerbot, PaymentHub paymentHub) = getBrokerbotAndPaymentHub(IERC20(params.tokenIn), IERC20(params.tokenOut));
		// @TODO: check possiblity to not call buyprice here, as it get called again in brokerbot
		amountIn = brokerbot.getBuyPrice(params.amountOut); // get current price, so nothing needs to be refunded
		IERC20(params.tokenIn).transferFrom(msg.sender, address(this), amountIn); // transfer base currency into this contract
    if (IERC20(params.tokenIn).allowance(address(this), address(paymentHub)) == 0){
			// max is fine as the router shouldn't hold any funds, so this should be ever only needed to be set once per token/paymenthub
			IERC20(params.tokenIn).approve(address(paymentHub), type(uint256).max); 
		}
		// call paymenthub to buy shares with base currency
		paymentHub.payAndNotify(brokerbot, amountIn,  bytes("\x01"));
		// transfer bought shares to recipient
		if (!IERC20(params.tokenOut).transfer(params.recipient, params.amountOut)) {
			revert Brokerbot_Swap_Failed();
		}
  }

	/**
	 * @notice Buy share tokens with any erc20 by given a uniswap routing path
	 * @param params Params struct for swap. See @ISwapRouter for struct definition.
	 */
	function exactOutput(ExactOutputParams calldata params) external payable override checkDeadline(params.deadline) returns (uint256 amountIn) {
		PaymentParams memory paymentParams;
		paymentParams.hasMultiPools = params.path.hasMultiplePools();
		(address firstTokenIn, address firstTokenOut, uint24 fee) = params.path.decodeFirstPool();
		if (paymentParams.hasMultiPools) {
			paymentParams.path = params.path.skipLastToken();
			(paymentParams.baseToken, paymentParams.shareToken, fee) = params.path.getLastPool().decodeFirstPool();
		} else {
			paymentParams.baseToken = firstTokenIn;
			paymentParams.shareToken = firstTokenOut;
		}
		(paymentParams.brokerbot, paymentParams.paymentHub) = getBrokerbotAndPaymentHub(IERC20(paymentParams.baseToken), IERC20(paymentParams.shareToken));
		//amountIn = brokerbot.getBuyPrice(params.amountOut);
		IERC20(firstTokenIn).transferFrom(msg.sender, address(this), params.amountInMaximum);
		if (IERC20(firstTokenIn).allowance(address(this), address(paymentParams.paymentHub)) == 0){
			// max is fine as the router shouldn't hold any funds, so this should be ever only needed to be set once per token/paymenthub
			IERC20(firstTokenIn).approve(address(paymentParams.paymentHub), type(uint256).max); 
		}
		// call paymenthub to buy shares with any erc20
		paymentParams.baseAmount = paymentParams.brokerbot.getBuyPrice(params.amountOut);
		paymentParams.paymentHub.payFromERC20AndNotify(paymentParams.brokerbot, paymentParams.baseAmount, firstTokenIn, params.amountInMaximum, paymentParams.path, bytes("\x01"));
		if (!IERC20(paymentParams.shareToken).transfer(params.recipient, params.amountOut)) {
			revert Brokerbot_Swap_Failed();
		}
	}

	/**
	 * @notice Sell share tokens for base currency.
	 * @param params Params struct for swap . See @ISwapRouter for struct definition.
	 */
	function exactInputSingle(
		ExactInputSingleParams calldata params
	) external payable override checkDeadline(params.deadline) returns (uint256 amountOut) {
		(IBrokerbot brokerbot, PaymentHub paymentHub) = getBrokerbotAndPaymentHub(IERC20(params.tokenOut), IERC20(params.tokenIn));
		IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn); // transfer shares into this contract
		// send shares to brokerbot to sell them against base currency
		ERC20Flaggable(params.tokenIn).transferAndCall(address(brokerbot), params.amountIn, bytes("\x01"));
		// transfer base currency to recipient
		amountOut = IERC20(params.tokenOut).balanceOf(address(this));
		if (!IERC20(params.tokenOut).transfer(params.recipient, amountOut)) {
			revert Brokerbot_Swap_Failed();
		}
	}

	// TODO: implement swap to sell share token for any erc20
	function exactInput(ExactInputParams calldata params) external payable override checkDeadline(params.deadline) returns (uint256 amountOut) {}

	// TODO: implement refund of eth that was overpaid
	function refundETH() external payable override {}

	// TODO: implement to get price 
	function getQuote() external {}

	function getBrokerbotAndPaymentHub(IERC20 base, IERC20 token) public view returns (IBrokerbot brokerbot, PaymentHub paymentHub) {
		brokerbot = brokerbotRegistry.getBrokerbot(base, token);
		if (address(brokerbot) == address(0)) revert Brokerbot_Not_Found();
    paymentHub = PaymentHub(payable(brokerbot.paymenthub()));
	}
}