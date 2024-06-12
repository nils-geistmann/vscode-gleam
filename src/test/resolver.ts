import { TextDecoder } from "util";
import { Position, Range, RelativePattern, TestController, TestItem, Uri, workspace } from "vscode";

const testLineRegexp = /^pub fn (.*)_test\(.*{$/;

export class Resolver {
    controller: TestController;

    constructor(controller: TestController) {
        this.controller = controller;
        this.controller.resolveHandler = async (item: TestItem | undefined) => {
            await this.resolveTests(item);
        };
    }

    private async resolveTests(test: TestItem | undefined) {
        if (test || test === undefined) {
            this.resolveAllTests();
        } else {
            this.parseTestsInFileContents(test);
        }
    }
    private resolveAllTests() {
        if (workspace.workspaceFolders === undefined) {
            return [];
        }

        return Promise.all(
            workspace.workspaceFolders.map(async workspaceFolder => {
                const testFilePattern = new RelativePattern(workspaceFolder, 'test/**/*.gleam');
                const watcher = workspace.createFileSystemWatcher(testFilePattern);

                watcher.onDidCreate(uri => this.handleNewFile(uri));
                watcher.onDidChange(uri => this.handleFileUpdates(uri));
                watcher.onDidDelete(uri => this.controller.items.delete(uri.toString()));

                for (const file of await workspace.findFiles(testFilePattern)) {
                    this.handleNewFile(file);
                }

                return watcher;
            })
        )
    }

    private async handleNewFile(uri: Uri) {
        const fileName = uri.path.split('/').pop();
        if (fileName) {
            let testItem = this.controller.createTestItem(uri.toString(), fileName, uri);
            this.parseTestsInFileContents(testItem);

            this.controller.items.add(testItem);
        }
    }

    private async handleFileUpdates(uri: Uri) {
        let testItem = this.controller.items.get(uri.toString());
        if (testItem) {
            testItem.children.replace([]);
            this.parseTestsInFileContents(testItem);
        }
    }

    private async parseTestsInFileContents(file: TestItem, contents?: string) {
        if (contents === undefined) {
            const rawContent = await workspace.fs.readFile(file.uri as Uri);
            contents = new TextDecoder().decode(rawContent);
        }

        contents.split("\n")
            .map((line, index) => {
                let matches = testLineRegexp.exec(line);
                if (matches) {
                    return { line: index, match: matches };
                }
                return null;
            })
            .forEach((test) => {
                if (test != null) {
                    let testItem = this.controller.createTestItem(
                        file.id + `:${test.line}`,
                        test.match[1],
                        file.uri
                    )
                    testItem.range = new Range(
                        new Position(test.line, 0),
                        new Position(test.line, test.match[0].length)
                    );
                    file.children.add(testItem);
                }
            })
    }
}

