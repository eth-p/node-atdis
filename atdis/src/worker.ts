//! --------------------------------------------------------------------------------------------------------------------
//! atdis | https://github.com/eth-p/node-atdis | MIT License | Copyright (C) 2020 eth-p
//! --------------------------------------------------------------------------------------------------------------------
import type {Scheduler} from "./scheduler";

// ---------------------------------------------------------------------------------------------------------------------
const NOOP = () => {};

/**
 * A worker that executes tasks taken from a scheduler.
 * This executes in the main event loop.
 */
export class Worker {

	private _scheduler: Scheduler<any, any>;
	private _state: WorkerState;
	private _running: boolean;
	private _wakeFunction: () => void;
	private _stall: null | unknown;
	private _stallPromise: null | Promise<void>;

	/**
	 * The current worker state.
	 */
	public get state() {
		return this._state;
	}

	/**
	 * Creates a new worker.
	 * @param scheduler The scheduler to perform work from.
	 */
	public constructor(scheduler: Scheduler<any, any>) {
		this._scheduler = scheduler;

		this._state = WorkerState.STOPPED;
		this._stall = null;
		this._stallPromise = null;
		this._running = false;
		this._wakeFunction = NOOP;
	}

	/**
	 * Stalls the worker for a given number of milliseconds.
	 * This can be used to throttle scheduled tasks.
	 *
	 * @param milliseconds The number of milliseconds to stall.
	 */
	public stall(milliseconds: number): void {
		if (milliseconds <= 0) return;

		const wake = this._wakeFunction;
		
		// Clear the old stall promise.
		if (this._stall !== null) {
			clearTimeout(this._stall as any);
			this._stall = null;
			this._stallPromise = null;
		}
		
		// Create a new stall promise.
		this._stallPromise = new Promise(resolve => {
			this._wakeFunction = resolve;
			this._stall = setTimeout(() => {
				this._wake();
				this._stall = null;
				this._stallPromise = null;
			}, milliseconds);
		});
		
		// Wake the old stall.
		wake();
	}

	/**
	 * Stalls the worker until a given date.
	 * This can be used to throttle scheduled tasks.
	 *
	 * @param date The date to stall until.
	 */
	public stallUntil(date: Date): void {
		this.stall(date.getTime() - Date.now());
	}

	/**
	 * Starts the worker.
	 * If the worker is stalled, this will force the worker to start.
	 *
	 * @throws Error When the worker is running or idle.
	 */
	public start(): void {
		if (this._running && this._stall == null) {
			throw new Error(`Attempted to start a ${this._state.toLowerCase()} worker.`);
		}

		// Start the worker.
		this._stall = null;
		
		if (!this._running) {
			this._running = true;
			this._main().catch(error => {
				console.warn("atdis worker crashed", error);
			}).finally(() => {
				this._state = WorkerState.STOPPED;
				this._stall = null;
				this._running = false;
			});
		}
		
		// Wake the worker.
		this._wake();
	}


	/**
	 * Tries to start the worker.
	 * If the worker cannot be started, this will return false.
	 */
	public tryStart(): boolean {
		if (this._running && this._stall == null) return false;
		this.start();
		return true;
	}

	/**
	 * Stops the worker after it's current task is finished.
	 * @throws Error If the worker is already running.
	 */
	public stop(): void {
		if (!this._running) throw new Error(`Attempted to stop a ${this._state.toLowerCase()} worker.`);

		// Stop the worker.
		this._stall = null;
		this._stallPromise = null;
		this._running = false;
		this._wake();
	}

	/**
	 * Tries to stop the worker after it's current task if finished.
	 * If the worker cannot be stopped, this will return false.
	 */
	public tryStop(): boolean {
		if (!this._running) return false;
		this.stop();
		return true;
	}

	/**
	 * Wakes the worker up.
	 * @private
	 */
	private _wake(): void {
		this._wakeFunction();
		this._wakeFunction = NOOP;
	}
	
	/**
	 * Waits until a new task is available.
	 * @private
	 */
	private _waitOnTask(): Promise<void> {
		// TODO: Replace this with a promise-based semaphore.
		return new Promise(resolve => {
			this._scheduler.once('schedule', () => {
				resolve();
			})
		});
	}

	/**
	 * W
	 * @private
	 */
	private _waitOnStall(): Promise<void> {
		return this._stallPromise!;
	}

	/**
	 * The main worker loop.
	 * @internal
	 */
	private async _main(): Promise<void> {
		while (this._running) {
			if (this._stall !== null) {
				this._state = WorkerState.STALLED;
				await this._waitOnStall();
				continue;
			}
			
			// Get the task.
			this._state = WorkerState.IDLE;
			const task = this._scheduler.next();
			if (task === null) {
				await this._waitOnTask();
				continue;
			}
			
			// Execute the task.
			try {
				this._state = WorkerState.RUNNING;
				await task.run();
			} catch(ex) {
			}
		}
	}

}

/**
 * The state of a worker.
 */
export enum WorkerState {

	/**
	 * The worker is idle.
	 */
	IDLE = 'IDLE',

	/**
	 * The worker is running.
	 */
	RUNNING = 'RUNNING',

	/**
	 * The worker is stalled.
	 */
	STALLED = 'STALLED',

	/**
	 * The worker is stopped.
	 */
	STOPPED = 'STOPPED',

}
