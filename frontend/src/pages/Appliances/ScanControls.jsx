import { useEffect, useRef, useState } from "react";
import { Camera, CircleCheck, Smartphone, Upload } from "lucide-react";
import { api } from "@/api";
import Spinner from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { scanErrorMessage, shrinkPhoto } from "@/lib/scan";
import PhoneScanDialog from "./PhoneScanDialog";

export default function ScanControls({ onResult, disabled }) {
  const uploadInput = useRef(null);
  const cameraInput = useRef(null);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [phoneOpen, setPhoneOpen] = useState(false);
  // A slow scan can finish after the user switched to editing (this unmounts); drop its result.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function fill(result) {
    onResult(result);
    setStatus({
      state: "done",
      message: "Scan complete. Check the suggested values, then add hours per day.",
    });
  }

  async function handleFile(event) {
    const file = event.target.files[0];
    // Reset so picking the same file again still fires "change".
    event.target.value = "";
    if (!file) return;

    setStatus({ state: "reading", message: "Reading the label..." });
    try {
      const result = await api.readLabel(await shrinkPhoto(file));
      if (mounted.current) fill(result);
    } catch (error) {
      if (mounted.current) setStatus({ state: "error", message: scanErrorMessage(error) });
    }
  }

  const reading = status.state === "reading";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          disabled={disabled || reading}
          onClick={() => uploadInput.current.click()}
        >
          <Upload />
          Upload photo
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="md:hidden"
          disabled={disabled || reading}
          onClick={() => cameraInput.current.click()}
        >
          <Camera />
          Take photo
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="hidden md:inline-flex"
          disabled={disabled || reading}
          onClick={() => setPhoneOpen(true)}
        >
          <Smartphone />
          Use my phone
        </Button>
      </div>

      {/* The buttons open these, so they stay out of the tab order and the accessibility tree. */}
      <input
        ref={uploadInput}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={handleFile}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={handleFile}
      />

      <p
        role="status"
        className={`flex items-center gap-2 text-sm empty:hidden ${
          status.state === "error" ? "text-danger" : "text-muted-foreground"
        }`}
      >
        {reading && <Spinner label="Reading the label" />}
        {status.state === "done" && <CircleCheck className="size-4 shrink-0 text-green" />}
        {status.message}
      </p>

      <PhoneScanDialog open={phoneOpen} onOpenChange={setPhoneOpen} onResult={fill} />
    </div>
  );
}
