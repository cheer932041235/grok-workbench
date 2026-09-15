import { describe, expect, it } from "vitest";
import { imageContent, imageUrl } from "./images";
import { PromptQueue } from "./queue";

describe("image prompts", () => {
  const image = { name: "example.png", mimeType: "image/png", data: "AQID" };
  it("sends image bytes with their MIME type", () => {
    expect(imageContent([image])).toEqual([{ type: "image", mimeType: "image/png", data: "AQID" }]);
    expect(imageUrl(image)).toBe("data:image/png;base64,AQID");
  });
  it("restores attachments with their queued demand and preserves old text records", async () => {
    const received: unknown[] = [];
    let done!: () => void;
    const finished = new Promise<void>((resolve) => (done = resolve));
    const queue = new PromptQueue(
      async (text, images) => {
        received.push({ text, images });
        return true;
      },
      (view) => {
        if (!view.running && received.length === 2) done();
      },
    );
    queue.restore(["text only", { text: "", images: [image] }]);
    queue.resume();
    await finished;
    expect(received).toEqual([
      { text: "text only", images: undefined },
      { text: "", images: [image] },
    ]);
  });
});
