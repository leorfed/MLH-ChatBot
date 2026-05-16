import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCamera,
  FaPlus,
  FaStar,
  FaRegStar,
  FaTrash,
  FaImage,
} from "react-icons/fa";
import { HiSparkles } from "react-icons/hi2";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { ImageSlideshow } from "@/components/ImageSlideshow";

type ImageEntry = { id: number; url: string; active?: boolean };

export default function MyImagesPage() {
  const { user } = useAuth();

  // Avatar
  const [avatars, setAvatars] = useState<ImageEntry[]>([]);
  const [avatarX, setAvatarX] = useState(50);
  const [avatarY, setAvatarY] = useState(50);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarDragRef = useRef<{ startX: number; startY: number; startAx: number; startAy: number } | null>(null);

  // Banner
  const [banners, setBanners] = useState<ImageEntry[]>([]);
  const [bannerX, setBannerX] = useState(50);
  const [bannerY, setBannerY] = useState(50);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerDragRef = useRef<{ startX: number; startY: number; startBx: number; startBy: number } | null>(null);

  // Personal images
  const [personalImages, setPersonalImages] = useState<ImageEntry[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAvatar = avatars.find((a) => a.active) ?? avatars[0] ?? null;
  const bannerUrls = banners.map((b) => b.url);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.getMyAvatars(),
      api.getMyBanners(),
      api.getMyPersonalImages(),
      api.getMyProfile(),
    ]).then(([avatarList, bannerList, imageList, profile]) => {
      setAvatars(avatarList);
      setBanners(bannerList);
      setPersonalImages(imageList);
      if (profile) {
        setAvatarX(profile.avatar_x ?? 50);
        setAvatarY(profile.avatar_y ?? 50);
        setBannerX(profile.banner_x ?? 50);
        setBannerY(profile.banner_y ?? 50);
      }
      setLoading(false);
    });
  }, [user]);

  const savePositions = async () => {
    setSaving(true);
    const result = await api.saveMyProfile({
      avatar_x: avatarX,
      avatar_y: avatarY,
      banner_x: bannerX,
      banner_y: bannerY,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#00ffff]/30 border-t-[#00ffff] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 py-8 pb-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 font-display tracking-wider">
            MY <span className="text-[#ff0080] neon-glow-pink">IMAGES</span>
          </h1>
          <p className="text-gray-400 font-body text-sm">Manage your avatar, banner, and personal photos</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="space-y-6"
        >
          {/* ── AVATAR ─────────────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-5">
            <SectionLabel text="AVATAR" />

            <div className="flex items-start gap-5">
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div
                  className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#00ffff]/30 bg-[#0a0b1a] select-none"
                  style={{ cursor: activeAvatar ? "grab" : "default" }}
                  onMouseDown={activeAvatar ? (e) => {
                    e.preventDefault();
                    avatarDragRef.current = { startX: e.clientX, startY: e.clientY, startAx: avatarX, startAy: avatarY };
                    const onMove = (mv: MouseEvent) => {
                      if (!avatarDragRef.current) return;
                      const dx = (mv.clientX - avatarDragRef.current.startX) / 2;
                      const dy = (mv.clientY - avatarDragRef.current.startY) / 2;
                      setAvatarX(Math.min(100, Math.max(0, avatarDragRef.current.startAx - dx)));
                      setAvatarY(Math.min(100, Math.max(0, avatarDragRef.current.startAy - dy)));
                    };
                    const onUp = () => {
                      avatarDragRef.current = null;
                      window.removeEventListener("mousemove", onMove);
                      window.removeEventListener("mouseup", onUp);
                    };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  } : undefined}
                >
                  {activeAvatar ? (
                    <img
                      src={activeAvatar.url}
                      alt="Avatar"
                      className="w-full h-full object-cover pointer-events-none"
                      style={{ objectPosition: `${avatarX}% ${avatarY}%` }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FaCamera className="text-gray-600 text-2xl" />
                    </div>
                  )}
                </div>
                {activeAvatar && (
                  <p className="text-[10px] text-gray-600 font-body">drag to reposition</p>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <label className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-[#0a0b1a]/80 border border-[#00ffff]/15 text-[#00ffff] text-sm font-body cursor-pointer hover:border-[#00ffff]/40 transition-all">
                  <FaCamera className="text-xs" />
                  {uploadingAvatar ? "UPLOADING..." : avatars.length ? "ADD AVATAR" : "UPLOAD AVATAR"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingAvatar}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingAvatar(true);
                      const result = await api.uploadAvatar(file);
                      setUploadingAvatar(false);
                      if (result.data) {
                        setAvatars(result.data);
                        setAvatarX(50);
                        setAvatarY(50);
                      } else {
                        setError(result.error ?? "Upload failed");
                      }
                    }}
                  />
                </label>
                <p className="text-[10px] text-gray-600 font-body text-center">
                  {avatars.length} photo{avatars.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {avatars.length > 0 && (
              <ImageGrid
                images={avatars}
                onActivate={async (id) => {
                  const updated = await api.activateAvatar(id);
                  if (updated) setAvatars(updated);
                }}
                onDelete={async (id) => {
                  const updated = await api.deleteAvatar(id);
                  if (updated) setAvatars(updated);
                }}
                showActivate
              />
            )}
          </div>

          {/* ── BANNER ─────────────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-5">
            <SectionLabel text="BANNER" />

            <div
              className="relative w-full h-40 rounded-xl overflow-hidden border border-[#00ffff]/15 bg-[#0a0b1a] select-none"
              style={{ cursor: bannerUrls.length ? "grab" : "default" }}
              onMouseDown={bannerUrls.length ? (e) => {
                e.preventDefault();
                bannerDragRef.current = { startX: e.clientX, startY: e.clientY, startBx: bannerX, startBy: bannerY };
                const onMove = (mv: MouseEvent) => {
                  if (!bannerDragRef.current) return;
                  const dx = (mv.clientX - bannerDragRef.current.startX) / 3;
                  const dy = (mv.clientY - bannerDragRef.current.startY) / 3;
                  setBannerX(Math.min(100, Math.max(0, bannerDragRef.current.startBx - dx)));
                  setBannerY(Math.min(100, Math.max(0, bannerDragRef.current.startBy - dy)));
                };
                const onUp = () => {
                  bannerDragRef.current = null;
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              } : undefined}
            >
              {bannerUrls.length ? (
                <ImageSlideshow
                  urls={bannerUrls}
                  objectX={bannerX}
                  objectY={bannerY}
                  alt="Banner"
                  className="w-full h-full object-cover pointer-events-none"
                  interval={5000}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FaImage className="text-gray-700 text-2xl" />
                </div>
              )}
              {bannerUrls.length > 1 && (
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-gray-400 font-body">
                  {bannerUrls.length} photos · slideshow
                </div>
              )}
            </div>
            {bannerUrls.length > 0 && (
              <p className="text-[10px] text-gray-600 font-body -mt-2">drag preview to reposition · save to apply</p>
            )}

            <label className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-[#0a0b1a]/80 border border-[#00ffff]/15 text-[#00ffff] text-sm font-body cursor-pointer hover:border-[#00ffff]/40 transition-all">
              <FaCamera className="text-xs" />
              {uploadingBanner ? "UPLOADING..." : banners.length ? "ADD BANNER" : "UPLOAD BANNER"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingBanner}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingBanner(true);
                  const result = await api.uploadBanner(file);
                  setUploadingBanner(false);
                  if (result.data) {
                    setBanners(result.data);
                    setBannerX(50);
                    setBannerY(50);
                  } else {
                    setError(result.error ?? "Upload failed");
                  }
                }}
              />
            </label>

            {banners.length > 0 && (
              <ImageGrid
                images={banners}
                onActivate={async (id) => {
                  const updated = await api.activateBanner(id);
                  if (updated) setBanners(updated);
                }}
                onDelete={async (id) => {
                  const updated = await api.deleteBanner(id);
                  if (updated) setBanners(updated);
                }}
                showActivate
              />
            )}
          </div>

          {/* ── PERSONAL PHOTOS ────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-5">
            <SectionLabel text="MY PHOTOS" />
            <p className="text-[11px] text-gray-500 font-body -mt-2">Personal photos stored in your gallery</p>

            <label className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-[#0a0b1a]/80 border border-[#ff0080]/15 text-[#ff0080] text-sm font-body cursor-pointer hover:border-[#ff0080]/40 transition-all">
              <FaPlus className="text-xs" />
              {uploadingImage ? "UPLOADING..." : "ADD PHOTO"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingImage}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingImage(true);
                  const result = await api.uploadPersonalImage(file);
                  setUploadingImage(false);
                  if (result.data) {
                    setPersonalImages((prev) => [result.data!, ...prev]);
                  } else {
                    setError(result.error ?? "Upload failed");
                  }
                }}
              />
            </label>

            {personalImages.length > 0 ? (
              <ImageGrid
                images={personalImages}
                onDelete={async (id) => {
                  const ok = await api.deletePersonalImage(id);
                  if (ok) setPersonalImages((prev) => prev.filter((i) => i.id !== id));
                }}
                showActivate={false}
              />
            ) : (
              <div className="text-center py-6 text-gray-600 font-body text-sm">No photos yet</div>
            )}
          </div>

          {/* ── SAVE POSITIONS ─────────────────────────────────────── */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-body text-center"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={savePositions}
            disabled={saving}
            className="w-full flex items-center justify-center gap-3 py-3.5 bg-gradient-to-r from-[#00ffff]/20 to-[#0099cc]/20 border border-[#00ffff]/30 text-[#00ffff] font-bold text-xs tracking-wider rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-[#00ffff]/10 font-display disabled:opacity-50"
          >
            {saving ? "SAVING..." : saved ? "SAVED ✓" : "SAVE POSITIONS"}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}

interface ImageGridProps {
  images: { id: number; url: string; active?: boolean }[];
  onActivate?: (id: number) => void;
  onDelete: (id: number) => void;
  showActivate: boolean;
}

function ImageGrid({ images, onActivate, onDelete, showActivate }: ImageGridProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {images.map((img) => (
        <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border border-white/10">
          <img src={img.url} alt="" className="w-full h-full object-cover" />
          {showActivate && img.active && (
            <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-[#00ffff] flex items-center justify-center">
              <FaStar className="text-black text-[8px]" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            {showActivate && !img.active && onActivate && (
              <button
                title="Set as active"
                onClick={() => onActivate(img.id)}
                className="w-7 h-7 rounded-full bg-[#00ffff]/20 border border-[#00ffff]/50 flex items-center justify-center hover:bg-[#00ffff]/40 transition-colors"
              >
                <FaRegStar className="text-[#00ffff] text-[10px]" />
              </button>
            )}
            <button
              title="Delete"
              onClick={() => onDelete(img.id)}
              className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center hover:bg-red-500/40 transition-colors"
            >
              <FaTrash className="text-red-400 text-[10px]" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <HiSparkles className="text-[#00ffff] text-xs" />
      <span className="text-xs text-gray-400 tracking-widest font-display font-bold">{text}</span>
    </div>
  );
}
