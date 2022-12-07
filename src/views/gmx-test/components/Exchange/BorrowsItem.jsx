import React from 'react';
import Tooltip from './../Tooltip/Tooltip';
import { formatAmount } from '../../lib/legacy';
import { ImSpinner2 } from 'react-icons/im';
import { t } from '@lingui/macro';
import { USD_DECIMALS, INCREASE } from './../../lib/legacy';
import StatsTooltipRow from '../StatsTooltip/StatsTooltipRow';
import { floor } from './../../../../components/utils/math';
import CollateralLocked from './CollateralLocked';
import { DDL_AccountManagerToken, getDgContract } from '../../../../components/utils/contracts';
import { DDL_GMX, WETH_address } from './../../../../components/utils/contracts';
import { useState, useEffect } from 'react';
import { Trans } from '@lingui/macro';
import { BigNumber } from 'ethers';
import { ADDRESS_ZERO } from '@uniswap/v3-sdk';

const BorrowsItem = (props) => {
	const {
		position,
		onPositionClick,
		setListSection,
		positionOrders,
		showPnlAfterFees,
		hasPositionProfit,
		positionDelta,
		borrowState, 
		setBorrowState,
		repayState, 
		setRepayState,
		hasOrderError,
		liquidationPrice,
		cx,
		dgAddress,
		isLarge,
	} = props;

	const [curPosition, setCurPosition] = useState(position);
	const [borrowed, setBorrowed] = useState(undefined);
	const [isLocked, setIsLocked] = useState(false);
	const [borrowStep, setBorrowStep] = useState(0);
	const [repayStep, setRepayStep] = useState(0);
	
	const borrowPosition = () => {
		setBorrowState({
			...borrowState,
			position: curPosition,
			initStep: borrowStep,
			isVisible: true,
		})
	}
	const repayPosition = () => {
		setRepayState({
			...repayState,
			position: curPosition,
			initStep: repayStep,
			isVisible: true,
		})
	}

	useEffect(() => {
		// Key id for positions
		const DG = getDgContract(dgAddress);
		if (!DG) {
			return
		}
		DG.keyByIndexToken((position.indexToken.address === ADDRESS_ZERO ? WETH_address : position.indexToken.address), position.isLong)
			.then(id => {
				position.ddl.keyId = id;

				// Initial Steps
				DDL_AccountManagerToken.ownerOf(id)
					.then(owner => {
						const isLocked = owner === DDL_GMX.address;
						setIsLocked(isLocked);
						if (isLocked) {
							setBorrowStep(2);
							
							// Borrowed
							DDL_GMX.borrowedByCollateral(id)
							.then(res => {
								position.ddl.borrowed = res.borrowed;
								setCurPosition(position);

								if (res.borrowed.gt(0)) {
									setRepayStep(0);
								} else {
									setRepayStep(1);
								}
								setBorrowed(res.borrowed);
							})
						} else {
							setBorrowed(BigNumber.from(0));
							
							if (false) {
								// isApproved? 
								setBorrowStep(1);
							} else {
								setBorrowStep(0);
							}
						}
					});
			})
	}, [dgAddress, borrowState, repayState])
	

	return (
		<>
			{isLarge ?
				<tr>
				<td className="clickable" onClick={() => onPositionClick(position)}>
					<div className="Exchange-list-title">
						{position.indexToken.symbol}
						{position.hasPendingChanges && <ImSpinner2 className="spin position-loading-icon" />}
					</div>
					<div className="Exchange-list-info-label">
						{position.leverage && (
							<span className="muted">{formatAmount(position.leverage, 4, 2, true)}x&nbsp;</span>
						)}
						<span className={cx({ positive: position.isLong, negative: !position.isLong })}>
							{position.isLong ? "Long" : "Short"}
						</span>
					</div>
				</td>
				<td>
					<div>
						{!position.netValue && "Opening..."}
						{position.netValue && (
							<Tooltip
								handle={`$${formatAmount(position.netValue, USD_DECIMALS, 2, true)}`}
								position="left-bottom"
								handleClassName="plain"
								renderContent={() => {
									return (
										<>
											Net Value:{" "}
											{showPnlAfterFees
												? t`Initial Collateral - Fees + PnL`
												: t`Initial Collateral - Borrow Fee + PnL`}
											<br />
											<br />
											<StatsTooltipRow
												label={t`Initial Collateralt`}
												value={formatAmount(position.collateral, USD_DECIMALS, 2, true)}
											/>
											<StatsTooltipRow label={`PnL`} value={position.deltaBeforeFeesStr} showDollar={false} />
											<StatsTooltipRow
												label={t`Borrow Fee`}
												value={formatAmount(position.fundingFee, USD_DECIMALS, 2, true)}
											/>
											<StatsTooltipRow
												label={`Open + Close fee`}
												value={formatAmount(position.positionFee, USD_DECIMALS, 2, true)}
											/>
											<StatsTooltipRow
												label={`PnL After Fees`}
												value={`${position.deltaAfterFeesStr} (${position.deltaAfterFeesPercentageStr})`}
												showDollar={false}
											/>
										</>
									);
								}}
							/>
						)}
					</div>
					{position.deltaStr && (
						<div
							className={cx("Exchange-list-info-label", {
								positive: hasPositionProfit && positionDelta.gt(0),
								negative: !hasPositionProfit && positionDelta.gt(0),
								muted: positionDelta.eq(0),
							})}
						>
							{position.deltaStr} ({position.deltaPercentageStr})
						</div>
					)}
				</td>
				<td>
					<div>${formatAmount(position.ddl.available, USD_DECIMALS, 2, true)}</div>
					{positionOrders.length > 0 && (
						<div onClick={() => setListSection && setListSection("Orders")}>
							<Tooltip
								handle={`Orders (${positionOrders.length})`}
								position="left-bottom"
								handleClassName={cx(
									["Exchange-list-info-label", "Exchange-position-list-orders", "plain", "clickable"],
									{ muted: !hasOrderError, negative: hasOrderError }
								)}
								renderContent={() => {
									return (
										<>
											<strong>Active Orders</strong>
											{positionOrders.map((order) => {
												return (
													<div
														key={`${order.isLong}-${order.type}-${order.index}`}
														className="Position-list-order"
													>
														{order.triggerAboveThreshold ? ">" : "<"}{" "}
														{formatAmount(order.triggerPrice, 30, 2, true)}:
														{order.type === INCREASE ? " +" : " -"}${formatAmount(order.sizeDelta, 30, 2, true)}
														{order.error && (
															<>
																, <span className="negative">{order.error}</span>
															</>
														)}
													</div>
												);
											})}
										</>
									);
								}}
							/>
						</div>
					)}
				</td>
				<td>
					${borrowed ? formatAmount(borrowed, USD_DECIMALS, 2, true) : '...'}
				</td>
				<td className="" onClick={() => {
					// onPositionClick(position)
					return;
				}}>
					<Tooltip
						handle={`$${formatAmount(position.markPrice, USD_DECIMALS, 2, true)}`}
						position="left-bottom"
						handleClassName="plain"
						renderContent={() => {
							return (
								<div>
									Click on a row to select the position's market, then use the swap box to increase your
									position size if needed.
									<br />
									<br />
									Use the "Close" button to reduce your position size, or to set stop-loss / take-profit orders.
								</div>
							);
						}}
					/>
				</td>
				<td className="" onClick={() => {
					// onPositionClick(position)
					return;
				}}>
					${formatAmount(liquidationPrice, USD_DECIMALS, 2, true)}
				</td>
				<td className="" onClick={() => {
					// onPositionClick(position)
					return;
				}}>
					{'13.3%'}
				</td>
	
				<td className="td-btn">
					<button
						className="Exchange-list-action"
						onClick={() => borrowPosition(position)}
						disabled={typeof borrowed === 'undefined' || !position.hasProfit}
					>
						Borrow
						{(typeof borrowed === 'undefined' || !position.hasProfit)
							&& <Tooltip
										className="btn-tooltip"
										position="right-bottom"
										enabled={true}
										handle=""
										renderContent={() => {
											return (
												<div>
													You can't lock position if it's unprofitable
												</div>
											);
										}} />}
					</button>
				</td>
				<td className="td-btn">
					<button
						className="Exchange-list-action"
						onClick={() => repayPosition(position)}
						disabled={typeof borrowed === 'undefined' || !isLocked}
					>
						Repay
					</button>
				</td>
				<td className="td-btn">
					{isLocked &&
						<CollateralLocked />}
				</td>
			</tr>
			:
			<div className="App-card">
				<div className="App-card-divider"></div>
				<div className="App-card-content">
					<div className="App-card-row">
						<div className="label">
							<Trans>Position</Trans>
						</div>
						<div>
							<div className="Exchange-list-token">{position.indexToken.symbol}</div>
							<span
								className={cx("Exchange-list-side", {
									positive: position.isLong,
									negative: !position.isLong,
								})}
							><span className="Exchange-list-leverage">{formatAmount(position.leverage, 4, 2, true)}x&nbsp;</span>
								{position.isLong ? t`Long` : t`Short`}
							</span>
						</div>
					</div>
					<div className="App-card-row">
						<div className="label">
							<Trans>Net Value</Trans>
						</div>
						<div>
							<Tooltip
								handle={`$${formatAmount(position.netValue, USD_DECIMALS, 2, true)}`}
								position="right-bottom"
								handleClassName="plain"
								renderContent={() => {
									return (
										<>
											Net Value:{" "}
											{showPnlAfterFees
												? "Initial Collateral - Fees + PnL"
												: "Initial Collateral - Borrow Fee + PnL"}
											<br />
											<br />
											<StatsTooltipRow
												label="Initial Collateral"
												value={formatAmount(position.collateral, USD_DECIMALS, 2, true)}
											/>
											<StatsTooltipRow label="PnL" value={position.deltaBeforeFeesStr} showDollar={false} />
											<StatsTooltipRow
												label="Borrow Fee"
												value={formatAmount(position.fundingFee, USD_DECIMALS, 2, true)}
											/>
											<StatsTooltipRow
												label="Open + Close fee"
												value={formatAmount(position.positionFee, USD_DECIMALS, 2, true)}
											/>
											<StatsTooltipRow
												label="PnL After Fees"
												value={`${position.deltaAfterFeesStr} (${position.deltaAfterFeesPercentageStr})`}
												showDollar={false}
											/>
										</>
									);
								}}
							/>
						</div>
					</div>
					<div className="App-card-row">
						<div className="label">
							<Trans>Available</Trans>
						</div>
						<div>${formatAmount(position.ddl.available, USD_DECIMALS, 2, true)}</div>
					</div>
					<div className="App-card-row">
						<div className="label">
							<Trans>Debt</Trans>
						</div>
						<div>${formatAmount(borrowed, USD_DECIMALS, 2, true)}</div>
						<div>
						</div>
					</div>
				</div>
				<div className="App-card-divider"></div>
				<div className="App-card-content">
					<div className="App-card-row">
						<div className="label">
							<Trans>Current Price</Trans>
						</div>
						<div>${formatAmount(position.markPrice, USD_DECIMALS, 2, true)}</div>
					</div>
					<div className="App-card-row">
						<div className="label">
							<Trans>Liq. Price</Trans>
						</div>
						<div>${formatAmount(liquidationPrice, USD_DECIMALS, 2, true)}</div>
					</div>
					<div className="App-card-row">
						<div className="label">
							<Trans>Borrow APY</Trans>
						</div>
						<div>{'13.33%'}</div>
					</div>
				</div>
				<div className="App-card-divider"></div>
				<div className="App-card-options">
					<button
						className="App-button-option App-card-option"
						disabled={typeof borrowed === 'undefined' || !position.hasProfit}
						onClick={() => borrowPosition()}
					>
						<Trans>Borrow</Trans>
						{(typeof borrowed === 'undefined' || !position.hasProfit)
							&& <Tooltip
								className="btn-tooltip"
								position="right-bottom"
								enabled={true}
								handle=""
								renderContent={() => {
									return (
										<div>
											You can't lock position if it's unprofitable
										</div>
									);
								}} />}
					</button>
					<button
						className="App-button-option App-card-option"
						disabled={typeof borrowed === 'undefined' || !isLocked}
						onClick={() => repayPosition()}
					>
						Repay
					</button>

					{isLocked &&
						<CollateralLocked />}
				</div>
			</div>}
		</>
	);
};

export default BorrowsItem;