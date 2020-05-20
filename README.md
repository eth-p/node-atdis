# atdis
A simple abstract task dispatching library.

## Usage

```typescript
import {Scheduler, Worker} from "atdis";
const scheduler = new Scheduler<string>();
const worker = new Worker(scheduler);
worker.start();

// Tasks are slow async functions.
function download(name: string): Promise<string> {
    return new Promise(resolve => {
        setTimeout(() => resolve(`Hello ${name}!`), 500);
    })
}

// A scheduler uses priority queues to order tasks.
const task = scheduler.schedule(download, {data: 'world'});
const task2 = scheduler.schedule(download, {
    data: 'world',
    retries: 5     // If the task fails, it can be rescheduled transparently.
});

// Tasks can be awaited on.
const data = await task;
```
