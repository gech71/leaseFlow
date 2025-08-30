// This component is no longer used and can be deleted.
// The rich text editor feature was removed to resolve dependency installation issues.

"use client";

import React from 'react';

interface RichTextEditorProps {
  initialContent: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

export function RichTextEditor({ initialContent, onChange, editable = true }: RichTextEditorProps) {
  return (
    <textarea
      value={initialContent}
      onChange={(e) => onChange(e.target.value)}
      disabled={!editable}
      className="w-full h-64 p-2 border rounded-md"
    />
  );
}
