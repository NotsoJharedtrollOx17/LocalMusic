import { useMusicAppContext } from "./MusicAppContext";

export default function ImportInputs() {
  const { fileInput, folderInput, doImport } = useMusicAppContext();

  return (
    <>
      <input
        hidden
        ref={fileInput}
        type="file"
        accept="audio/*,.flac,.opus,.ogg,.m4a"
        multiple
        onChange={(e) => {
          const selected = Array.from(e.target.files ?? []);
          if (selected.length) void doImport(selected);
          e.target.value = "";
        }}
      />
      <input
        hidden
        ref={folderInput}
        type="file"
        multiple
        {...({ webkitdirectory: "" } as object)}
        onChange={(e) => {
          const selected = Array.from(e.target.files ?? []);
          if (selected.length) void doImport(selected);
          e.target.value = "";
        }}
      />
    </>
  );
}
