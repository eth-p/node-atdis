//! --------------------------------------------------------------------------------------------------------------------
//! atdis-request | https://github.com/eth-p/node-atdis | MIT License | Copyright (C) 2020 eth-p
//! --------------------------------------------------------------------------------------------------------------------
import type {Request} from "./request";
import type {ThrottlePolicy} from "./throttle";
import {ThrottleError} from "./throttle";
import DefaultPolicy from "./throttle-policy";

import type {ScheduledTask} from "atdis";
import {Scheduler, TaskState, Worker} from "atdis";

import * as LRU from "lru-cache";

// ---------------------------------------------------------------------------------------------------------------------

/**
 * A pool of requests.
 */
export class RequestPool<Throttle extends ThrottleError = ThrottleError> {

	protected _workers: Worker[];
	protected _workerLimit: number;

	protected _scheduler: Scheduler<unknown>;
	protected _cache: LRU<string, ScheduledTask<unknown>>;

	protected _throttlePolicy: ThrottlePolicy<Throttle>;

	public metadata: {
		[key: string]: any;
		throttle: { [key: string]: any };
	};

	/**
	 * Creates a new request pool.
	 * @param options The pool options.
	 */
	public constructor(options?: RequestPoolOptions<Throttle>) {
		this._workers = [];
		this._workerLimit = options?.workers ?? 5;
		this._throttlePolicy = options?.policy ?? new DefaultPolicy();

		this._scheduler = new Scheduler();
		this._cache = new LRU({
			max: options?.maxEntries ?? 500,
			maxAge: options?.maxAge ?? 1000 * 60 * 15,
		});

		this.metadata = {throttle: {}};
		this.setWorkerLimit(this._workerLimit);

		// Add event listeners.
		this._scheduler.on('failedAttempt', this._tryThrottle.bind(this));
		this._scheduler.on('failedTask', this._tryThrottle.bind(this));
	}

	/**
	 * Called when a task or task attempt fails.
	 * If the error was a {@link ThrottleError}, it will cause the pool to throttle.
	 * 
	 * @param task The task.
	 * @param error The error.
	 * @internal
	 */
	protected _tryThrottle(task: ScheduledTask<unknown>, error: any): void {
		if (error instanceof ThrottleError) {
			this._throttlePolicy.throttle(error as any, this);
		}
	}

	/**
	 * The task workers.
	 */
	public get workers(): Worker[] {
		return this._workers;
	}

	/**
	 * Sets the maximum number of workers.
	 * @param limit The worker limit.
	 */
	public setWorkerLimit(limit: number): void {
		// Remove or add workers.
		if (limit < this._workers.length) {
			this._workers
				.splice(limit)
				.forEach(worker => worker.tryStop());
		} else if (limit > this._workers.length) {
			for (let i = this._workers.length; i < limit; i++) {
				const worker = new Worker(this._scheduler);
				worker.tryStart();
				this._workers.push(worker);
			}
		}

		// Set the limit variable.
		this._workerLimit = limit;
	}

	/**
	 * Gets the maximum number of workers.
	 */
	public getWorkerLimit(): number {
		return this._workerLimit;
	}

	/**
	 * Creates a new request and adds it to the pool.
	 *
	 * @param type The request type.
	 * @param args The request arguments.
	 */
	public request<Class extends { new(...args: any): R }, T, R extends Request<T>>(type: Class, ...args: ConstructorParameters<Class>): Promise<T> {
		const instance: R = new type(...Array.from(args));
		const cacheKey = instance.key;

		// If it's already cached, we return the cached request.
		if (instance.cacheable) {
			const cached = this._cache.get(cacheKey);
			if (cached !== undefined && !(cached.state === TaskState.FAILED || cached.state !== TaskState.CANCELLED)) {
				return cached as unknown as Promise<T>;
			}
		}

		// Create the scheduled task for the request.
		const scheduled = this._scheduler.schedule(instance, {
			retries: instance.retries
		});

		// Cache the request.
		if (instance.cacheable) {
			this._cache.set(cacheKey, scheduled);
		}

		// Return the request.
		return scheduled as unknown as Promise<T>;
	}

}

export interface RequestPoolOptions<Throttle extends ThrottleError> {

	/**
	 * The maximum number of cache entries.
	 * Defaults to 500.
	 */
	maxEntries?: number;

	/**
	 * The maximum age of cache entries.
	 * Defaults to 15 minutes.
	 */
	maxAge?: number;

	/**
	 * The throttling policy.
	 */
	policy?: ThrottlePolicy<Throttle>;

	/**
	 * The maximum number of parallel workers.
	 * Defaults to 5 workers.
	 */
	workers?: number;

}
