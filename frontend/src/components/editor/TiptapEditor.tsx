"use client";

import { Button, Select, Tooltip } from "antd";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { useEffect, useRef, useState } from "react";

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Uploads a file and resolves to its public URL. Falls back to inline
   *  base64 embedding (not recommended for large images) if omitted. */
  onUploadImage?: (file: File) => Promise<string>;
}

const HEADING_OPTIONS = [
  { label: "Paragraph", value: "paragraph" },
  { label: "Heading 1", value: "h1" },
  { label: "Heading 2", value: "h2" },
  { label: "Heading 3", value: "h3" },
];

export function TiptapEditor({ value, onChange, onUploadImage }: TiptapEditorProps) {
  const [showHtml, setShowHtml] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState(value || "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      Image.configure({ inline: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[260px] rounded-b-lg border-x border-b border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none " +
          "[&_img]:max-w-full [&_img]:rounded-md " +
          "[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:my-4 " +
          "[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:my-3 " +
          "[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-snug [&_h3]:my-2 " +
          "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === value) return;
    editor.commands.setContent(value || "", false);
  }, [editor, value]);

  useEffect(() => {
    setHtmlDraft(value || "");
  }, [value]);

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter link URL", previousUrl ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const currentHeading = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
    ? "h3"
    : "paragraph";

  const setHeading = (val: string) => {
    if (val === "paragraph") {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = Number(val.replace("h", "")) as 1 | 2 | 3;
      editor.chain().focus().toggleHeading({ level }).run();
    }
  };

  const triggerImageUpload = () => fileInputRef.current?.click();

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    setUploading(true);
    try {
      for (const file of files) {
        const src = onUploadImage ? await onUploadImage(file) : await readFileAsDataUrl(file);
        editor.chain().focus("end").insertContent({ type: "image", attrs: { src } }).run();
      }
    } finally {
      setUploading(false);
    }
  };

  const toggleHtmlView = () => {
    if (!showHtml) {
      setHtmlDraft(editor.getHTML());
    } else {
      editor.commands.setContent(htmlDraft || "", false);
      onChange(htmlDraft || "");
    }
    setShowHtml((prev) => !prev);
  };

  return (
    <div className="rounded-lg">
      <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-slate-200 bg-slate-50 p-2">
        <Select
          size="small"
          value={currentHeading}
          onChange={setHeading}
          options={HEADING_OPTIONS}
          style={{ width: 120 }}
          disabled={showHtml}
        />
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <Tooltip title="Bold">
          <Button
            size="small"
            type={editor.isActive("bold") ? "primary" : "text"}
            icon={<Bold size={14} />}
            disabled={showHtml}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
        </Tooltip>
        <Tooltip title="Italic">
          <Button
            size="small"
            type={editor.isActive("italic") ? "primary" : "text"}
            icon={<Italic size={14} />}
            disabled={showHtml}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
        </Tooltip>
        <Tooltip title="Underline">
          <Button
            size="small"
            type={editor.isActive("underline") ? "primary" : "text"}
            icon={<UnderlineIcon size={14} />}
            disabled={showHtml}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
        </Tooltip>
        <Tooltip title="Align left">
          <Button
            size="small"
            type={editor.isActive({ textAlign: "left" }) ? "primary" : "text"}
            icon={<AlignLeft size={14} />}
            disabled={showHtml}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          />
        </Tooltip>
        <Tooltip title="Align center">
          <Button
            size="small"
            type={editor.isActive({ textAlign: "center" }) ? "primary" : "text"}
            icon={<AlignCenter size={14} />}
            disabled={showHtml}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          />
        </Tooltip>
        <Tooltip title="Align right">
          <Button
            size="small"
            type={editor.isActive({ textAlign: "right" }) ? "primary" : "text"}
            icon={<AlignRight size={14} />}
            disabled={showHtml}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          />
        </Tooltip>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <Tooltip title="Bullet list">
          <Button
            size="small"
            type={editor.isActive("bulletList") ? "primary" : "text"}
            icon={<List size={14} />}
            disabled={showHtml}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
        </Tooltip>
        <Tooltip title="Numbered list">
          <Button
            size="small"
            type={editor.isActive("orderedList") ? "primary" : "text"}
            icon={<ListOrdered size={14} />}
            disabled={showHtml}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
        </Tooltip>
        <Tooltip title="Link">
          <Button
            size="small"
            type={editor.isActive("link") ? "primary" : "text"}
            icon={<LinkIcon size={14} />}
            disabled={showHtml}
            onClick={setLink}
          />
        </Tooltip>
        <Tooltip title="Insert image(s)">
          <Button
            size="small"
            type="text"
            icon={<ImageIcon size={14} />}
            loading={uploading}
            disabled={showHtml || uploading}
            onClick={triggerImageUpload}
          />
        </Tooltip>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => void handleImageFile(e)}
          style={{ display: "none" }}
        />
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <Tooltip title="Undo">
          <Button
            size="small"
            type="text"
            icon={<Undo2 size={14} />}
            disabled={showHtml || !editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          />
        </Tooltip>
        <Tooltip title="Redo">
          <Button
            size="small"
            type="text"
            icon={<Redo2 size={14} />}
            disabled={showHtml || !editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          />
        </Tooltip>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <Tooltip title={showHtml ? "Back to editor" : "View HTML"}>
          <Button
            size="small"
            type={showHtml ? "primary" : "text"}
            icon={<Code2 size={14} />}
            onClick={toggleHtmlView}
          >
            HTML
          </Button>
        </Tooltip>
      </div>
      {showHtml ? (
        <textarea
          className="min-h-[260px] w-full rounded-b-lg border-x border-b border-slate-200 bg-slate-900 px-4 py-3 font-mono text-xs leading-6 text-slate-100 outline-none"
          value={htmlDraft}
          onChange={(e) => setHtmlDraft(e.target.value)}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}
