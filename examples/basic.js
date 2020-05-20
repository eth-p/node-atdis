const {Scheduler, Worker} = require("../");

// Create a new scheduler and worker.
const scheduler = new Scheduler();
const worker = new Worker(scheduler);
worker.start();
worker.start();

// Tasks are slow async functions.
function download(name) {
	return new Promise(resolve => {
		console.log(`Started: ${name}`)
		setTimeout(() => resolve(`Hello ${name}!`), 500);
	})
}

function flaky(func) {
	let remaining = 5;
	return (...args) => {
		console.log(`Flaky...`);
		if (--remaining === 0) return func(...args);
		return new Promise((_, reject) => reject("Failed."));
	}
}

// A scheduler uses priority queues to order tasks.
const task = scheduler.schedule(download, {data: 'task 1'});
const task2 = scheduler.schedule(download, {data: 'task 2'});
const task3 = scheduler.schedule(flaky(download), {
	data: 'world',
	retries: 5
});

// Tasks can be awaited on.
async function main() {
	console.log("Task 1 Result:", await task);
	console.log("Task 2 Result:", await task2);
	console.log("Task 3 Result:", await task3);
}

main();
