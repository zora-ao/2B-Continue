import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Camera, CircleCheck } from "lucide-react";
import { api } from "@/api";
import PageHeader from "@/components/PageHeader";
import Spinner from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { scanErrorMessage, shrinkPhoto } from "@/lib/scan";

// Opened on a phone from the QR code on the desktop Appliances page.
export default function ScanPhotoPage() {
  const { code } = useParams();
  const cameraInput = useRef(null);
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState({ state: "idle", message: "" }); // idle | sending | sent | expired | error

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFile(event) {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setStatus({ state: "sending", message: "Sending the photo..." });
    try {
      await api.sendScanPhoto(code, await shrinkPhoto(file));
      setStatus({ state: "sent", message: "Sent! Check your computer." });
    } catch (error) {
      setStatus({ state: error.status === 410 ? "expired" : "error", message: scanErrorMessage(error) });
    }
  }

  const canTakePhoto = status.state === "idle" || status.state === "error";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <PageHeader title="Scan appliance" subtitle="Take a clear photo of the rating label." />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-black">
            {preview ? (
              <img src={preview} alt="Your photo of the rating label" className="size-full object-contain" />
            ) : (
              <Camera aria-hidden="true" className="size-10 text-muted-foreground" />
            )}
          </div>

          <p
            role="status"
            className={`flex items-center gap-2 text-sm empty:hidden ${
              status.state === "error" || status.state === "expired" ? "text-danger" : "text-muted-foreground"
            }`}
          >
            {status.state === "sending" && <Spinner label="Sending the photo" />}
            {status.state === "sent" && <CircleCheck className="size-4 shrink-0 text-green" />}
            {status.message}
          </p>

          {canTakePhoto && (
            <Button type="button" size="lg" onClick={() => cameraInput.current.click()}>
              <Camera />
              {status.state === "error" ? "Try again" : "Take photo"}
            </Button>
          )}
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
        </CardContent>
      </Card>
    </div>
  );
}
