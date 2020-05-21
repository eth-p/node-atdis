//! --------------------------------------------------------------------------------------------------------------------
//! atdis | https://github.com/eth-p/node-atdis | MIT License | Copyright (C) 2020 eth-p
//! --------------------------------------------------------------------------------------------------------------------

import {PromiseValue} from "./type";

/**
 * A runnable task.
 */
export type Task<R, T = void> = (({ run(data: T): R }) | ((data: T) => R)) & {

	/**
	 * The task priority.
	 * The higher the priority, the sooner the task should be executed.
	 */
	readonly priority?: number;

	/**
	 * The maximum number of attempts to make.
	 * If the task fails, it will reschedule the task.
	 * 
	 * This defaults to 0.
	 */
	readonly attempts?: number;

}

/**
 * The state of a task.
 */
export enum TaskState {

	/**
	 * The task is queued.
	 */
	QUEUED = 'QUEUED',

	/**
	 * The task is running.
	 */
	RUNNING = 'RUNNING',

	/**
	 * The task was completed successfully.
	 */
	COMPLETED = 'COMPLETED',

	/**
	 * The task failed.
	 */
	FAILED = 'FAILED',

	/**
	 * The task was cancelled.
	 */
	CANCELLED = 'CANCELLED',

}

/**
 * A scheduled task.
 * This can be resolved like a promise.
 * 
 * ## Example
 * ```ts
 * const task = scheduler.schedule(() => 'Hello, world!');
 * task.run(); // 'Hello, world!'
 * 
 * ```
 */
export interface ScheduledTask<R, T = undefined> extends PromiseLike<R> {

	/**
	 * The task identifier.
	 */
	readonly id: number;

	/**
	 * The task state.
	 */
	readonly state: TaskState;

	/**
	 * The scheduled time of the task.
	 */
	readonly scheduled: number;

	/**
	 * The attempt number of the task.
	 */
	readonly attempt: number;

	/**
	 * The task priority.
	 * A higher number will be scheduled to execute first.
	 */
	readonly priority: number | undefined;

	/**
	 * The task's input data.
	 * This is provided as the first argument to the task function.
	 */
	readonly data: T;

	/**
	 * Runs a single attempt of the task.
	 * 
	 * When the task is asynchronous, this returns a Promise.
	 * When the task is synchronous, this returns the value.
	 * 
	 * If the attempt fails, the fuunction will return and the task will be rescheduled to run again.
	 * You can prevent this by catching the error, and calling {@link cancel}.
	 * 
	 * @throws Error If the task was cancelled.
	 */
	run(): PromiseValue<R> | Promise<PromiseValue<R>>;

	/**
	 * Cancels the task.
	 * This will reject anything awaiting the task.
	 * 
	 * @throws Error If the task is already running.
	 */
	cancel(): void;

}
