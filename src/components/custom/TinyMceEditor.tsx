
"use client";

import React, { useRef } from "react";
import { Editor } from "@tinymce/tinymce-react";

interface TinyMceEditorProps {
  value: string;
  onEditorChange: (content: string, editor: any) => void;
  disabled?: boolean;
}

export function TinyMceEditor({
  value,
  onEditorChange,
  disabled,
}: TinyMceEditorProps) {
  const editorRef = useRef<any>(null);

  return (
    <Editor
      apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || "no-api-key"}
      onInit={(_evt, editor) => (editorRef.current = editor)}
      value={value}
      onEditorChange={onEditorChange}
      disabled={disabled}
      init={{
        height: 350,
        menubar: false,
        z_index: 1500,
        plugins: [
          "advlist",
          "autolink",
          "lists",
          "link",
          "image",
          "charmap",
          "preview",
          "anchor",
          "searchreplace",
          "visualblocks",
          "code",
          "fullscreen",
          "insertdatetime",
          "media",
          "table",
          "help",
        ],
        toolbar:
          "undo redo | blocks | " +
          "bold italic forecolor backcolor | alignleft aligncenter " +
          "alignright alignjustify | bullist numlist outdent indent | " +
          "removeformat | help",
        content_style: "body { font-family:Inter,sans-serif; font-size:14px }",
        skin:
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "oxide-dark"
            : "oxide",
        content_css:
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "default",
        branding: false,
      }}
    />
  );
}
