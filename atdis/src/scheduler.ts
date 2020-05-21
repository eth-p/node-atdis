//! --------------------------------------------------------------------------------------------------------------------
//! atdis | https://github.com/eth-p/node-atdis | MIT License | Copyright (C) 2020 eth-p
//! --------------------------------------------------------------------------------------------------------------------
import {ScheduledTask as Scheduled, Task, TaskState} from "./task";

import PriorityQueue from "priorityqueue";
import {EventEmitter} from "tsee";
import {PromiseValue} from "./type";

// ---------------------------------------------------------------------------------------------------------------------
const NOOP: () => any = () => {};

/**
 * A priority-based task scheduler.
 *
 * ## Example
 * ```ts
 * const scheduler = new Scheduler<string>();
 *
 * scheduler.schedule(() => 'Second');
 * scheduler.schedule(() => 'Third', {priority: 0});
 * scheduler.schedule(() => 'First', {priority: 5});
 *
 * scheduler.next(); // Gets the next task.
 * // ...
 * ```
 */
export class Scheduler<R, T = undefined> extends EventEmitter<{
	schedule: (task: Scheduled<R, T>) => void;
	failedTask: (task: Scheduled<R, T>, error: any) => void;
	failedAttempt: (task: Scheduled<R, T>, error: any) => void;
}> {

	private _queue: any;

	/**
	 * Creates a new scheduler.
	 */
	public constructor() {
		super()
		this._queue = new PriorityQueue({
			comparator: (a: any, b: any) => this.compare(a, b)
		});
	}

	/**
	 * Schedules a task.
	 *
	 * @param task The task to schedule.
	 * @param options The task options.
	 */
	public schedule(task: Task<R, T>, options: ScheduleOptions<R, T>): Scheduled<R, T> {
		const scheduled = new ScheduledTask(task, this, options);
		this._queue.push(scheduled);
		this.emit('schedule', scheduled);
		return scheduled;
	}

	/**
	 * Cancels a scheduled task.
	 * @param task The scheduled task.
	 */
	public cancel(task: Scheduled<R, T>) {
		if (task.state !== TaskState.CANCELLED) {
			task.cancel();
			return;
		}

		// Remove it from the queue.
		// Note: Can't do this with a priority queue, so we just remove it when popping.
	}

	/**
	 * Gets the next task from the scheduler.
	 * Task order is determined by the {@link compare} function.
	 *
	 * @returns The next scheduled task.
	 */
	public next(): null | Scheduled<R, T> {
		while (this._queue.length > 0) {
			let task: ScheduledTask<R, T> = this._queue.pop();
			if (task.state === TaskState.QUEUED) return task;
		}
		return null;
	}

	/**
	 * Compares two scheduled tasks to find which one has a higher priority.
	 *
	 * @param first The first task.
	 * @param second The second task.
	 */
	public compare(first: Scheduled<R, T>, second: Scheduled<R, T>): number {
		const now = Date.now();

		function calculate(task: Scheduled<R, T>) {
			return {
				retry: task.attempt,
				time: now - task.scheduled,
				priority: task.priority ?? 0,

				summary: function (): number {
					return (this.priority) + (this.time / 5000);
				}
			}
		}

		const fData = calculate(first);
		const sData = calculate(second);

		return fData.summary() - sData.summary();
	}

	/**
	 * Reschedules a task to run later.
	 *
	 * @param task The task to reschedule.
	 * @internal
	 */
	public _reschedule(task: ScheduledTask<R, T>): void {
		this._queue.push(task);
		this.emit('schedule', task);
	}

}

interface CommonScheduleOptions {

	/**
	 * The task priority.
	 */
	priority?: number;

	/**
	 * The number of retries.
	 * This defaults to 0.
	 */
	retries?: number;

}

type ScheduleOptions<R, T> = T extends void ? (void | CommonScheduleOptions) : (CommonScheduleOptions & {

	/**
	 * The task data.
	 */
	data: T;

});

/**
 * @internal
 */
class ScheduledTask<R, T> implements Scheduled<R, T> {
	private static _ID_COUNTER = 0;

	public then: any;
	
	private _promise: null | Promise<PromiseValue<R>>;
	private _resolve: (x: PromiseValue<R>) => {};
	private _reject: (x: any) => {};
	
	private _scheduler: Scheduler<R, T>;
	private _task: Task<R, T>;
	private _retries: number;

	public state: TaskState;
	public attempt: number;
	public readonly id: number;
	public readonly data: T;
	public readonly priority: number | undefined;
	public readonly scheduled: number;

	static get [Symbol.species]() {
		return Promise;
	}

	public constructor(task: Task<R, T>, scheduler: Scheduler<R, T>, options: ScheduleOptions<R, T>) {
		this._task = task;
		this._scheduler = scheduler;
		this._retries = (options as CommonScheduleOptions)?.retries ?? 0;
		
		this._promise = null;
		this._resolve = NOOP;
		this._reject = NOOP;

		this.state = TaskState.QUEUED;
		this.id = ScheduledTask._ID_COUNTER++;
		this.attempt = 0;

		this.data = (options as any)?.data ?? undefined;
		this.scheduled = Date.now();

		this.priority = (options as CommonScheduleOptions)?.priority ?? task.priority;
	}

	/**
	 * Completes the task as successful.
	 * @internal
	 */
	private _finishSuccess(data: PromiseValue<R>): void {
		this.state = TaskState.COMPLETED;
		this._resolve(data);
	}

	/**
	 * Completes the task as failed.
	 * If the task has attempts remaining, task will be rescheduled instead of failing.
	 * 
	 * @internal
	 */
	private _finishError(error: any): void {
		if (this._retries > 0) {
			this.state = TaskState.QUEUED;
			this._retries--;
			this.attempt++;
			this._scheduler._reschedule(this);
			this._scheduler.emit('failedAttempt', this, error);
			return;
		}

		// Fail.
		this.state = TaskState.FAILED;
		this._reject(error);
		this._scheduler.emit('failedTask', this, error);
	}

	/**
	 * Checks if the result of a task function is a promise.
	 *
	 * @param result The result data.
	 * @returns True if the result is a promise.
	 */
	private _isPromise(result: any): boolean {
		return (result != null && typeof (result as any).then === 'function');
	}

	/**
	 * @override
	 */
	public cancel(): void {
		if (this.state != TaskState.QUEUED) throw new Error(`Attempted to cancel a ${this.state.toLowerCase()} task.`);
		this.state = TaskState.CANCELLED;

		this._scheduler.cancel(this);

		// Reject the task.
		this._reject(new Error("Event cancelled."));
	}

	/**
	 * @override
	 */
	public run(): PromiseValue<R> | Promise<PromiseValue<R>> {
		if (this.state != TaskState.QUEUED) throw new Error(`Attempted to start a ${this.state.toLowerCase()} task.`);
		this.state = TaskState.RUNNING;

		// Get the task function.
		const executor = (typeof this._task === 'function')
			? this._task
			: (this._task as { run: (data: T) => R }).run.bind(this._task);

		// Start the task.
		try {
			const result: PromiseValue<R> | Promise<PromiseValue<R>> = executor(this.data) as any;
			if (!this._isPromise(result)) {
				// Non-async can return immediately.
				this._finishSuccess(result as PromiseValue<R>);
				return result;
			} else {
				// Async can return a new promise.
				return new Promise((resolve, reject) => {
					(result as any).then((data: any) => {
						this._finishSuccess(data);
						resolve(data);
					}, (error: any) => {
						this._finishError(error);
						reject(error);
					})
				}) as any;
			}
		} catch (error) {
			// Non-async can fail immediately.
			this._finishError(error);
			throw error;
		}
	}
}

// Copy Promise methods to ScheduledTask.
for (const method of Object.getOwnPropertyNames(Promise.prototype)) {
	Object.defineProperty(ScheduledTask.prototype, method, {
		enumerable: false,
		configurable: true,
		value: function() {
			if (this._promise == null) {
				this._promise = new Promise((resolve, reject) => {
					this._resolve = resolve;
					this._reject = reject;
				});
			}
			
			this._promise[method].apply(this._promise, arguments);
		}
	});
}
