import { describe, expect, it } from "vitest";
import { microphoneConstraints } from "./audioProcessing";

describe("microphoneConstraints", () => {
  it("enables native voice processing in standard mode", () => {
    expect(
      microphoneConstraints({ audioProcessing: "standard" })
    ).toMatchObject({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });
  });

  it("keeps echo cancellation but avoids double processing in ClearVoice", () => {
    expect(
      microphoneConstraints({
        audioProcessing: "clearvoice",
        audioInputId: "usb-microphone",
      })
    ).toMatchObject({
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: false,
      deviceId: { exact: "usb-microphone" },
    });
  });

  it("disables browser processing only when explicitly requested", () => {
    expect(microphoneConstraints({ audioProcessing: "off" })).toMatchObject({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    });
  });
});
