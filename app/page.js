"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";

export default function Home() {
  const [input, setInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [claim, setClaim] = useState("");
  const [verdict, setVerdict] = useState("VERDICT");
  const [hasResult, setHasResult] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [confidence, setConfidence] = useState("");
  const [sources, setSources] = useState([]);
  const [showShareCard, setShowShareCard] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const shareCardRef = useRef(null);

  function handleClear() {
    setInput("");
    setClaim("");
    setIsAnalyzing(false);
    setVerdict("VERDICT");
    setHasResult(false);
    setExplanation("");
    setConfidence("");
    setSources([]);
    setShowShareCard(false);
    setIsDownloading(false);
  }

  async function handleAnalyze() {
    if (isAnalyzing) return;
    if (!input.trim()) return;

    setIsAnalyzing(true);
    setClaim("");
    setVerdict("VERDICT");
    setHasResult(false);
    setExplanation("");
    setConfidence("");
    setSources([]);
    setShowShareCard(false);

    try {
      const response = await fetch("/api/fact-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Something went wrong");
        setIsAnalyzing(false);
        return;
      }

      setClaim(data.claim || "");
      setVerdict(data.verdict || "UNVERIFIABLE");
      setExplanation(data.explanation || "");
      setConfidence(data.confidence || "");
      setSources(Array.isArray(data.sources) ? data.sources : []);
      setHasResult(true);
    } catch (error) {
      alert("Failed to connect to AI");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleDownloadShareCard() {
    if (!shareCardRef.current) return;

    try {
      setIsDownloading(true);

      const dataUrl = await toPng(shareCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#f9f7f4",
      });

      const link = document.createElement("a");
      link.download = "factisizer-share-card.png";
      link.href = dataUrl;
      link.click();
    } catch (error) {
      alert("Failed to download share card image.");
    } finally {
      setIsDownloading(false);
    }
  }

  function getShareText() {
    return [
      "FACTISIZER",
      "",
      `Claim: ${getClaimText()}`,
      `Verdict: ${verdict || "--"}`,
      `Explanation: ${getShortExplanation() || "No explanation available."}`,
      `Confidence: ${confidence || "--"}`,
      "",
      "Factisizer",
    ].join("\n");
  }

  function getCurrentUrl() {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }

  function handleWhatsAppShare() {
    const shareText = getShareText();
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, "_blank");
  }

  function handleTelegramShare() {
    const shareText = getShareText();
    const currentUrl = getCurrentUrl();
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(
      currentUrl
    )}&text=${encodeURIComponent(shareText)}`;
    window.open(telegramUrl, "_blank");
  }

  function handleXShare() {
    const shareText = getShareText();
    const currentUrl = getCurrentUrl();
    const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      shareText
    )}&url=${encodeURIComponent(currentUrl)}`;
    window.open(xUrl, "_blank");
  }

  function handleFacebookShare() {
    const currentUrl = getCurrentUrl();

    if (
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1")
    ) {
      alert(
        "Facebook share works properly after deployment because Facebook mainly shares a public URL. On localhost, this is not useful yet."
      );
      return;
    }

    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      currentUrl
    )}`;
    window.open(facebookUrl, "_blank");
  }

  function getVerdictColor() {
    if (verdict === "FALSE") return "text-red-600";
    if (verdict === "TRUE") return "text-green-600";
    if (verdict === "UNVERIFIABLE") return "text-orange-500";
    return "text-black";
  }

  function getShareVerdictColor() {
    if (verdict === "FALSE") return "text-red-600";
    if (verdict === "TRUE") return "text-green-600";
    if (verdict === "UNVERIFIABLE") return "text-orange-500";
    return "text-gray-700";
  }

  function isMedicalClaim(text) {
    const medicalWords = [
      "health",
      "medical",
      "medicine",
      "doctor",
      "disease",
      "treatment",
      "cancer",
      "diabetes",
      "blood pressure",
      "cholesterol",
      "heart",
      "tablet",
      "drug",
      "vaccine",
      "hospital",
    ];

    const lowerText = text.toLowerCase();
    return medicalWords.some((word) => lowerText.includes(word));
  }

  function getClaimText() {
    const cleaned = (claim || "").trim();
    if (!cleaned) return "No claim";
    if (cleaned.length <= 140) return cleaned;
    return cleaned.slice(0, 140) + "...";
  }

  function getShortExplanation() {
    if (!explanation) return "";
    if (explanation.length <= 220) return explanation;
    return explanation.slice(0, 220) + "...";
  }

  return (
    <>
      <main className="min-h-screen bg-[#f3f3f3] flex flex-col items-center">
        <header className="w-full bg-white border-b border-gray-200 flex flex-col items-center pt-2 pb-3">
          <h1 className="text-[34px] leading-none font-bold tracking-tight">
            <span className="text-black">Facti</span>
            <span className="bg-blue-600 text-white px-1.5 ml-0.5 inline-block">
              sizer
            </span>
          </h1>
          <p className="text-[12px] text-gray-500 leading-none mt-1">
            Powered By Open AI
          </p>
        </header>

        <div className="w-full max-w-[430px] px-5 pt-6 pb-10">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste text or a link to check the facts"
            className="w-full h-[150px] rounded-[22px] border-[3px] border-[#2c2c2c] bg-white px-5 py-4 text-[16px] text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none"
          />

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              onClick={handleClear}
              className="flex-1 rounded-full border border-gray-300 bg-white py-3 text-[16px] font-medium text-black shadow-sm"
            >
              Clear
            </button>

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !input.trim()}
              className={`flex-1 rounded-full py-3 text-[16px] font-semibold text-white transition-all duration-500 ${
                isAnalyzing
                  ? "bg-blue-600 animate-pulse shadow-[0_0_20px_rgba(37,99,235,0.45)]"
                  : !input.trim()
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600"
              }`}
            >
              {isAnalyzing ? "Analyzing...." : "Enter"}
            </button>

            <div className="flex-1">
              {hasResult ? (
                <button
                  onClick={() => setShowShareCard(true)}
                  className="w-full rounded-full border border-gray-300 bg-white py-3 text-[16px] font-medium text-black shadow-sm"
                >
                  Share
                </button>
              ) : (
                <div className="h-[50px]" />
              )}
            </div>
          </div>

          <div className="mt-6 text-center">
            <h2
              className={`text-[30px] font-extrabold tracking-wide leading-none ${getVerdictColor()}`}
            >
              {verdict}
            </h2>
          </div>

          <div className="mt-3 rounded-[24px] bg-white px-6 py-6 shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
            {hasResult && claim && (
              <div className="mb-5 rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-4">
                <p className="text-[13px] font-semibold tracking-[0.18em] text-gray-500 text-center">
                  CLAIM
                </p>
                <p className="mt-2 text-[18px] leading-7 font-semibold text-black text-center">
                  {claim}
                </p>
              </div>
            )}

            <p className="text-[16px] leading-8 text-gray-800">
              <span className="font-bold text-black">Explanation: </span>
              {explanation || "Your result will appear here after analysis."}
            </p>

            <div className="mt-5">
              <p className="text-[16px] font-bold text-black">
                Confidence:{" "}
                <span className="font-semibold">{confidence || "--"}</span>
              </p>
            </div>

            <div className="mt-6">
              <p className="text-[16px] font-bold text-black mb-3">Sources:</p>

              <div className="space-y-3">
                {sources.length > 0 ? (
                  sources.map((source, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] text-gray-700"
                    >
                      {source}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] text-gray-700">
                    Sources will appear here after analysis.
                  </div>
                )}
              </div>
            </div>
          </div>

          {hasResult && isMedicalClaim(input) && (
            <div className="mt-5 rounded-[18px] border border-yellow-300 bg-yellow-100 px-5 py-4 text-[14px] leading-6 text-yellow-900">
              <span className="font-bold">Medical warning:</span> This result is
              for informational purposes only and should not be treated as
              medical advice. Always consult a qualified doctor or healthcare
              professional before making health-related decisions.
            </div>
          )}

          {hasResult && (
            <div className="mt-5 rounded-[18px] border border-gray-200 bg-white px-5 py-4 text-[14px] leading-6 text-gray-700">
              <span className="font-bold">Disclaimer:</span> Factisizer provides
              AI-assisted fact-checking for informational purposes. Results may
              not be perfect and should be verified with trusted primary sources
              before being relied upon.
            </div>
          )}

          <div className="mt-8 rounded-[10px] border border-gray-500 bg-white px-4 py-5 text-center text-[15px] font-medium text-gray-700">
            placeholder for google ads
          </div>
        </div>
      </main>

      {showShareCard && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div className="w-full max-w-[430px] rounded-t-[28px] bg-white px-5 pt-4 pb-6 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-300" />

            <div className="flex items-center justify-between mb-4 gap-3">
              <h3 className="text-[18px] font-bold text-black">Share Preview</h3>

              <button
                onClick={() => setShowShareCard(false)}
                className="rounded-full border border-gray-300 px-4 py-2 text-[14px] font-medium text-black"
              >
                Close
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={handleWhatsAppShare}
                className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-[14px] font-medium text-green-700"
              >
                WhatsApp
              </button>

              <button
                onClick={handleTelegramShare}
                className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-[14px] font-medium text-sky-700"
              >
                Telegram
              </button>

              <button
                onClick={handleXShare}
                className="rounded-full border border-gray-300 bg-gray-50 px-4 py-2 text-[14px] font-medium text-black"
              >
                X
              </button>

              <button
                onClick={handleFacebookShare}
                className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-[14px] font-medium text-blue-700"
              >
                Facebook
              </button>

              <button
                onClick={handleDownloadShareCard}
                disabled={isDownloading}
                className={`rounded-full border border-gray-300 px-4 py-2 text-[14px] font-medium text-black ${
                  isDownloading ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {isDownloading ? "Downloading..." : "Download"}
              </button>
            </div>

            <div
              ref={shareCardRef}
              className="rounded-[28px] border border-[#e6dfd6] bg-[#f9f7f4] px-5 py-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
            >
              <div className="text-center">
                <h2 className="text-[34px] leading-none font-bold tracking-tight">
                  <span className="text-black">Facti</span>
                  <span className="bg-blue-600 text-white px-1.5 ml-0.5 inline-block">
                    sizer
                  </span>
                </h2>
                <p className="text-[13px] text-gray-600 mt-1">
                  Check facts instantly
                </p>
              </div>

              <div className="mt-5 rounded-[22px] border border-[#ddd4ca] bg-white/80 px-4 py-4">
                <p className="text-center text-[13px] font-medium tracking-[0.25em] text-gray-500">
                  CLAIM
                </p>
                <p className="mt-3 text-center text-[24px] leading-8 font-semibold text-[#222]">
                  {getClaimText()}
                </p>
              </div>

              <div className="mt-5 w-full flex justify-center">
                <p
                  className={`text-center text-[44px] font-extrabold leading-none tracking-tight ${getShareVerdictColor()}`}
                >
                  {verdict}
                </p>
              </div>

              <div className="mt-5">
                <p className="text-[15px] leading-7 text-gray-800">
                  {getShortExplanation() || "Explanation will appear here."}
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-[15px] text-gray-700">
                    Confidence:{" "}
                    <span className="font-semibold text-black">
                      {confidence || "--"}
                    </span>
                  </p>
                </div>
                <div className="rounded-full border border-[#d9c7b4] bg-[#fffaf3] px-4 py-2 text-[12px] font-semibold tracking-wide text-[#7a5a36]">
                  VERIFIED BY FACTISIZER
                </div>
              </div>

              {sources.length > 0 && (
                <div className="mt-5">
                  <p className="text-[14px] font-bold text-black mb-2">
                    Sources
                  </p>
                  <div className="space-y-2">
                    {sources.slice(0, 2).map((source, index) => (
                      <div
                        key={index}
                        className="rounded-[14px] border border-[#e8e1d8] bg-white px-3 py-2 text-[12px] text-gray-700"
                      >
                        {source}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 text-center">
                <p className="text-[18px] font-semibold tracking-[0.22em] text-gray-600">
                  FACTISIZER.COM
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}