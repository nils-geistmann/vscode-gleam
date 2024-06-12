import { CancellationToken, TestController, TestItem, TestMessage, TestRunProfileKind, TestRunRequest, window } from "vscode";

export class Runner {
    controller: TestController;
    command: string;

    constructor(controller: TestController, command: string) {
        this.controller = controller;
        this.command = command;

        this.controller.createRunProfile(
            'Run Gleam Tests',
            TestRunProfileKind.Run,
            (request, token) => { this.runHandler(false, request, token) },
            true);
    }

    private async runHandler(
        shouldDebug: boolean,
        request: TestRunRequest,
        token: CancellationToken
    ) {
        if (shouldDebug) {
            window.showErrorMessage("Debugging is not supported yet");
            return;
        }

        const run = this.controller.createTestRun(request);
        const queue: TestItem[] = [];

        if (request.include) {
            request.include.forEach(test => queue.push(test));
        } else {
            this.controller.items.forEach(test => queue.push(test));
        }
        // For every test that was queued, try to run it. Call run.passed() or run.failed().
        // The `TestMessage` can contain extra information, like a failing location or
        // a diff output. But here we'll just give it a textual message.
        while (queue.length > 0 && !token.isCancellationRequested) {
            const test = queue.pop()!;

            // Skip tests the user asked to exclude
            if (request.exclude?.includes(test)) {
                continue;
            }

            const start = Date.now();
            // try {
            run.passed(test, Date.now() - start);
            // } catch (e) {
            //     run.failed(test, new TestMessage(e.message), Date.now() - start);
            // }

            test.children.forEach(test => queue.push(test));
        }

        run.end();
    }
}