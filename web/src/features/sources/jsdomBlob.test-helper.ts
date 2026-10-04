/**
 * jsdom's Blob/File implement neither `arrayBuffer()`, `text()` nor `stream()`, and Node's
 * fetch (what MSW intercepts under Vitest) needs `stream()` to serialise a multipart body.
 * `installJsdomBlobMethods()` fills the gap through jsdom's own FileReader — test-only.
 */

function readAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsArrayBuffer(blob);
  });
}

export function installJsdomBlobMethods(): void {
  const proto = Blob.prototype as unknown as {
    arrayBuffer?: () => Promise<ArrayBuffer>;
    text?: () => Promise<string>;
    stream?: () => ReadableStream<Uint8Array>;
  };
  if (typeof proto.arrayBuffer !== "function") {
    proto.arrayBuffer = function arrayBuffer(this: Blob) {
      return readAsArrayBuffer(this);
    };
  }
  if (typeof proto.text !== "function") {
    proto.text = async function text(this: Blob) {
      return new TextDecoder().decode(await readAsArrayBuffer(this));
    };
  }
  if (typeof proto.stream !== "function") {
    proto.stream = function stream(this: Blob) {
      const bytes = readAsArrayBuffer(this);
      return new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(new Uint8Array(await bytes));
          controller.close();
        },
      });
    };
  }
}
