"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export default function AdSense() {
  const bannerRef = useRef<HTMLModElement>(null);
  const boxRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    try {
      if (bannerRef.current) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
      if (boxRef.current) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (error) {
      console.error("AdSense error:", error);
    }
  }, []);

  return (
    <div className="text-center py-4">
      <p className="text-sm text-gray-400 mb-2">&gt;&gt;以下廣告由Google AdSense推播&lt;&lt;</p>

      {/* 橫幅廣告 320x50 */}
      <div className="flex justify-center mb-2">
        <ins
          ref={bannerRef}
          className="adsbygoogle"
          style={{ display: "block", width: "320px", height: "50px" }}
          data-ad-client="ca-pub-6708300535856225"
          data-ad-slot="6395280865"
        />
      </div>

      {/* 方塊廣告 320x200 */}
      <div className="flex justify-center">
        <ins
          ref={boxRef}
          className="adsbygoogle"
          style={{ display: "block", width: "320px", height: "200px" }}
          data-ad-client="ca-pub-6708300535856225"
          data-ad-slot="6395280865"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
