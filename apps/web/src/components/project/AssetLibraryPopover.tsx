import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ImagePlus, Upload } from 'lucide-react';
import type { Asset } from '@mulen/shared';

type AssetLibraryPopoverProps = {
  assets: Asset[];
  selectedAssetId?: string;
  onSelectAsset: (asset: Asset) => void;
  onUploadFile: (file: File) => void;
  children: ReactNode;
  placement?: 'right' | 'left';
};

export function AssetLibraryPopover(props: AssetLibraryPopoverProps) {
  const [open, setOpen] = useState(false);
  const inputId = useId();
  const anchorRef = useRef<HTMLDivElement | null>(null);

  const libraryAssets = useMemo(
    () => props.assets.filter((asset) => asset.mimeType.startsWith('image/') && asset.url),
    [props.assets],
  );

  const sampleAssets = useMemo<Asset[]>(
    () =>
      [
        'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=600&q=80',
      ].map((imageUrl, index) => ({
        id: `sample-${index}`,
        projectId: 'library',
        userId: 'library',
        kind: 'reference' as const,
        url: imageUrl,
        storagePath: `sample-${index + 1}.jpg`,
        mimeType: 'image/jpeg',
        createdAt: new Date(0).toISOString(),
        metadata: { placeholder: true },
      })),
    [],
  );

  const galleryItems = useMemo(() => {
    const items = [...libraryAssets];
    if (items.length >= 10) return items;
    const existingUrls = new Set(items.map((asset) => asset.url));
    for (const sample of sampleAssets) {
      if (items.length >= 10) break;
      if (existingUrls.has(sample.url)) continue;
      items.push(sample);
    }
    return items;
  }, [libraryAssets, sampleAssets]);

  const popoverStyle = useMemo(() => {
    if (!open || !anchorRef.current || typeof window === 'undefined') return undefined;

    const rect = anchorRef.current.getBoundingClientRect();
    const width = Math.min(760, window.innerWidth * 0.58);
    const gap = 12;
    const maxLeft = window.innerWidth - width - 16;
    const preferredLeft = props.placement === 'left' ? rect.left - width - gap : rect.right + gap;
    const left = Math.max(84, Math.min(preferredLeft, maxLeft));
    const top = Math.max(84, Math.min(rect.top - 6, window.innerHeight - 340));

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
    };
  }, [open, props.placement]);

  const processFiles = (fileList: FileList | File[]) => {
    const file = Array.from(fileList).find((item) => item.type.startsWith('image/'));
    if (!file) return;
    props.onUploadFile(file);
    setOpen(false);
  };

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (anchorRef.current?.contains(target)) return;
      setOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div
      ref={anchorRef}
      className="asset-library-anchor"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {props.children}
      {open ? (
        <div className="asset-library-popover" style={popoverStyle}>
          <label
            className="asset-library-upload-tile"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (event.dataTransfer.files) processFiles(event.dataTransfer.files);
            }}
          >
            <input
              id={inputId}
              accept="image/*"
              className="hidden-upload-input"
              type="file"
              onChange={(event) => {
                if (event.target.files) processFiles(event.target.files);
              }}
            />
            <Upload size={28} />
            <strong>Upload a file or drop it here</strong>
          </label>

          <div className="asset-library-grid">
            {galleryItems.map((asset) => {
              const isPlaceholder = asset.projectId === 'library';

              return (
              <button
                key={asset.id}
                className={
                  asset.id === props.selectedAssetId
                    ? 'asset-library-tile selected'
                    : isPlaceholder
                      ? 'asset-library-tile placeholder'
                      : 'asset-library-tile'
                }
                type="button"
                disabled={isPlaceholder}
                onClick={() => {
                  props.onSelectAsset(asset);
                  setOpen(false);
                }}
                title={asset.storagePath}
              >
                <img alt={asset.storagePath} src={asset.url} />
              </button>
              );
            })}
            {galleryItems.length === 0 ? (
              <div className="asset-library-empty">
                <ImagePlus size={18} />
                <span>Zatim tu nejsou zadne obrazky.</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
