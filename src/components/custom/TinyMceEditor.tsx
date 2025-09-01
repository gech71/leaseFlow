
"use client";

import React, { useEffect, useRef } from "react";
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

  useEffect(() => {
    // This effect addresses the z-index issue where TinyMCE dropdowns
    // (for fonts, colors, etc.) are hidden behind a modal overlay.
    const handleFocusIn = () => {
      if (editorRef.current) {
        // Find the top-level container of the TinyMCE UI
        const editorContainer = editorRef.current.editorContainer;
        if (editorContainer) {
          // Set its z-index to be higher than ShadCN's dialog z-index (which is 50)
          editorContainer.style.zIndex = 100;
        }
      }
    };
    
    // Using a timeout to ensure the editor has fully initialized before attaching listener
    const timer = setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.editor.on('focusin', handleFocusIn);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (editorRef.current && editorRef.current.editor) {
        // Cleanup the event listener when the component unmounts
        editorRef.current.editor.off('focusin', handleFocusIn);
      }
    };
  }, []);


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
          "textcolor",
          "colorpicker",
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
