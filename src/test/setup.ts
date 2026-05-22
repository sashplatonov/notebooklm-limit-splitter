import { vi } from "vitest";

// Store file contents for FileReader mock
const fileContents = new WeakMap<File, string>();

// Mock File API - store content for later retrieval
class MockFile extends File {
  constructor(parts: (string | BlobPart)[], filename: string, properties?: FilePropertyBag) {
    super(parts, filename, properties);
    const content = parts.map((p) => (typeof p === "string" ? p : "")).join("");
    fileContents.set(this, content);
  }
}

// Mock FileReader - must be synchronous for the tests to work
class MockFileReader {
  result: string | ArrayBuffer | null = null;
  error: DOMException | null = null;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

  readAsText(file: File, _encoding?: string): void {
    const content = fileContents.get(file) || "";
    this.result = content;
    // Synchronous callback - this is key for the tests to work
    // The event must have target.result set for the code to work
    if (this.onload) {
      const event = { target: { result: this.result } } as unknown as ProgressEvent<FileReader>;
      this.onload.call(this, event);
    }
  }
}

// Override globals before any test imports
vi.stubGlobal("File", MockFile);
vi.stubGlobal("FileReader", MockFileReader);

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = vi.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
global.localStorage = localStorageMock as Storage;

// Mock Notification
global.Notification = {
  permission: "default",
  requestPermission: vi.fn().mockResolvedValue("granted"),
} as any;

// Mock matchMedia
global.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));