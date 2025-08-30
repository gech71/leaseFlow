"use client";

import React from 'react';
import { Editor } from '@tinymce/tinymce-react';

interface TinyMceEditorProps {
  value: string;
  onEditorChange: (content: string, editor: any) => void;
  disabled?: boolean;
}

export function TinyMceEditor({ value, onEditorChange, disabled }: TinyMceEditorProps) {
  return (
    <Editor
      // You can get a free API key from tiny.cloud and add it to your .env file
      apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || 'no-api-key'}
      value={value}
      onEditorChange={onEditorChange}
      disabled={disabled}
      init={{
        height: 350,
        menubar: false,
        plugins: [
          'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
          'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
          'insertdatetime', 'media', 'table', 'help', 'wordcount'
        ],
        toolbar: 'undo redo | blocks | ' +
          'bold italic forecolor | alignleft aligncenter ' +
          'alignright alignjustify | bullist numlist outdent indent | ' +
          'removeformat | help',
        content_style: 'body { font-family:Inter,sans-serif; font-size:14px }',
        skin: (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'oxide-dark' : 'oxide',
        content_css: (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'default'
      }}
    />
  );
}
