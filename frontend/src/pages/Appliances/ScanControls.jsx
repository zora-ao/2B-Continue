import { useRef, useState } from "react";
import { Camera, CircleCheck, Smartphone, Upload } from "lucide-react";
import { api } from "@/api";
import Spinner from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { scanErrorMessage, shrinkPhoto } from "@/lib/scan";

export default function ScanControls({ onResult, onPhoneScan, disabled }) {
  const uploadInput = useRef(null);
  const cameraInput = useRef(null);
  const [status, setStatus] = useState({ state: "idle", message: "" });

  async function handleFile(event) {
    const file = event.target.files[0];
    // Reset so picking the same file again still fires "change".
    event.target.value = "";
    if (!file) return;

    setStatus({ state: "reading", message: "Reading the label..." });
    try {
      const result = await api.readLabel(await shrinkPhoto(file));
      onResult(result);
      setStatus({
        state: "done",
        message: "Filled from the rating label. Check the values, then add hours per day.",
      });
    } catch (error) {
      setStatus({ state: "error", message: scanErrorMessage(error) });
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
        {onPhoneScan && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="hidden md:inline-flex"
            disabled={disabled || reading}
            onClick={onPhoneScan}
          >
            <Smartphone />
            Use my phone
          </Button>
        )}
      </div>

      {/* The buttons open these; they stay out of the tab order. */}
      <input ref={uploadInput} type="file" accept="image/*" tabIndex={-1} className="sr-only" onChange={handleFile} />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
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
    </div>
  );
}
