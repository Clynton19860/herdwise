"use client";

import { useEffect, useRef, useState } from "react";
import { I } from "@/components/ui/icon";

export type UploadedPhoto = {
  id: string;
  name: string;
  size: number;
  preview: string;
};

export function PhotoUpload({
  photos,
  onChange,
  max = 6,
  hint = "JPG, PNG up to 10MB · captured location is embedded",
}: {
  photos: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  max?: number;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Revoke object URLs when component unmounts to avoid leaks
  useEffect(() => {
    const urls = photos.map((p) => p.preview);
    return () => {
      urls.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // no-op
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, max - photos.length);
    const added: UploadedPhoto[] = list.map((f) => ({
      id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      size: f.size,
      preview: URL.createObjectURL(f),
    }));
    onChange([...photos, ...added]);
  };

  const remove = (id: string) => {
    const p = photos.find((x) => x.id === id);
    if (p) {
      try {
        URL.revokeObjectURL(p.preview);
      } catch {
        // no-op
      }
    }
    onChange(photos.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-300
          ${dragging
            ? "border-emerald-300/60 bg-emerald-400/10"
            : "border-white/15 hover:border-white/30 hover:bg-white/3"}
          p-8 text-center`}
        role="button"
        tabIndex={0}
      >
        <div className="mx-auto h-14 w-14 rounded-2xl glass-thin grid place-items-center mb-3">
          <I.Sparkle size={22} className="text-emerald-300" />
        </div>
        <div className="text-sm font-medium">
          Drop photos here or <span className="text-emerald-300 underline">browse</span>
        </div>
        <div className="text-xs text-white/55 mt-1">{hint}</div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div
              key={p.id}
              className="group relative aspect-square rounded-2xl overflow-hidden glass-thin"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.preview}
                alt={p.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-2 left-2 right-2 text-[10px] text-white/85 font-mono truncate">
                {p.name}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(p.id);
                }}
                className="absolute top-2 right-2 h-7 w-7 rounded-xl glass-heavy text-white/85 hover:text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove"
              >
                <I.X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
