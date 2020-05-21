//! --------------------------------------------------------------------------------------------------------------------
//! atdis-request | https://github.com/eth-p/node-atdis | MIT License | Copyright (C) 2020 eth-p
//! --------------------------------------------------------------------------------------------------------------------
import type {RequestPool} from "./request-pool";
import type {ThrottlePolicy} from "./throttle";
import {ThrottleError} from "./throttle";
import {WorkerState} from "atdis";

// ---------------------------------------------------------------------------------------------------------------------

/**
 * An abstract class implementing {@link ThrottlePolicy}.
 */
export abstract class AbstractPolicy<Throttle extends ThrottleError, Pool extends RequestPool<Throttle> = RequestPool<Throttle>> implements ThrottlePolicy<Throttle> {

	protected throttleLimit: null | number;

	public constructor(options?: AbstractPolicyOptions) {
		this.throttleLimit = options?.throttleLimit ?? null;
	}

	/**
	 * Checks if throttling should be performed.
	 *
	 * @param throttle The throttle.
	 * @param pool The pool to throttle.
	 *
	 * @returns `true` if throttling is allowed.
	 */
	public canThrottle(throttle: Throttle, pool: Pool): boolean {
		if (pool.metadata.throttle.until == null) return true;
		return pool.metadata.throttle.until.getTime() > throttle.until.getTime();
	}

	/**
	 * Called when a request pool should be throttled.
	 * This is called after filtering and limiting is performed.
	 *
	 * @param throttle The throttle information.
	 * @param pool The pool to throttle.
	 */
	public abstract doThrottle(throttle: Throttle, pool: Pool): void;

	public throttle(throttle: Throttle, pool: Pool): void {
		const ms = throttle.until.getTime() - Date.now();
		if (ms <= 0 || !this.canThrottle(throttle, pool)) return;

		// Perform limiting.
		if (this.throttleLimit !== null && ms > this.throttleLimit) {
			throttle.until = new Date(Date.now() + this.throttleLimit);
		}

		// Start throttling.
		this.doThrottle(throttle, pool);
	}


}

interface AbstractPolicyOptions {

	/**
	 * The maximum number of milliseconds that can be throttled.
	 * If any {@link ThrottleError} exceeds this time, it will be reduced to the specified time.
	 */
	throttleLimit: number;

}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * A {@link ThrottlePolicy throttle policy} that suspends all requests and incrementally wakes them up.
 */
export class SuspendPolicy extends AbstractPolicy<ThrottleError> {

	protected _rate: number;

	/**
	 * Creates a new suspend policy.
	 * @param options The policy options.
	 */
	public constructor(options?: SuspendPolicyOptions) {
		super(options);
		this._rate = options?.rate ?? 5000;
	}

	public doThrottle(throttle: ThrottleError, pool: RequestPool<ThrottleError>): void {
		pool.metadata.throttle.until = throttle.until;

		// Clear the old throttle timers.
		if (pool.metadata.throttle.interval != null) {
			clearInterval(pool.metadata.throttle.interval);
			pool.metadata.throttle.interval = null;
		}

		if (pool.metadata.throttle.timer != null) {
			clearTimeout(pool.metadata.throttle.timer);
			pool.metadata.throttle.timer = null;
		}

		// Stop the workers.
		pool.workers.forEach(worker => worker.tryStop());

		// Start the new throttle timer.
		pool.metadata.throttle.timer = setTimeout(() => {
			function wake() {
				// Start a stopped worker.
				const worker = pool.workers.find(f => f.state === WorkerState.STOPPED);
				if (worker !== undefined) {
					worker.tryStart();
					return;
				}

				// If there are no stopped workers, clear the interval.
				clearInterval(pool.metadata.throttle.interval);
				pool.metadata.throttle.interval = null;
			}

			wake();
			pool.metadata.throttle.timer = null;
			pool.metadata.throttle.interval = setInterval(wake, this._rate);
		}, (throttle.until.getTime() - Date.now()));
	}

}

interface SuspendPolicyOptions extends AbstractPolicyOptions {

	/**
	 * The rate in milliseconds at which to wake up the workers.
	 * Defaults to 5000 (5 seconds).
	 */
	rate?: number;

}

export default SuspendPolicy;
