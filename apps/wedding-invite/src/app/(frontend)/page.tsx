"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, AnimatePresence, useInView } from "framer-motion";
import {
  Calendar,
  MapPin,
  Clock,
  Heart,
  ChevronDown,
  Send,
  Check,
  Phone,
  User,
  Users,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ==================== Animation Variants ====================

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.8, ease: "easeOut" as const },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const cardHover = {
  rest: { y: 0, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" },
  hover: {
    y: -8,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

// ==================== Floating Heart Component ====================

interface FloatingHeartProps {
  delay?: number;
  duration?: number;
  size?: number;
  left?: string;
  top?: string;
}

function FloatingHeart({
  delay = 0,
  duration = 3,
  size = 24,
  left = "50%",
  top = "50%",
}: FloatingHeartProps) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left, top }}
      initial={{ opacity: 0, y: 0, scale: 0 }}
      animate={{
        opacity: [0, 0.6, 0],
        y: [-20, -100],
        scale: [0.5, 1, 0.8],
        x: [0, Math.random() * 40 - 20],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeOut",
      }}
    >
      <Heart
        size={size}
        className="text-rose-300 fill-rose-200/50"
      />
    </motion.div>
  );
}

// ==================== Section Title Component ====================

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  className?: string;
}

interface PersonalizedInviteData {
  inviteCode: string;
  guestName: string;
  relationshipSide: string;
  relationshipCategory: string;
  relationshipNote: string;
  memorySnippet: string;
  customOpening: string;
  maxGuestCount: number;
}

interface MemoryPhotoItem {
  id: string | number;
  title: string;
  description: string;
  url: string;
}

interface MemoryPhotoData {
  couple: MemoryPhotoItem[];
  baby: MemoryPhotoItem[];
}

function SectionTitle({ title, subtitle, className }: SectionTitleProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      className={cn("text-center mb-12", className)}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={fadeInUp}
    >
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-rose-900 dark:text-rose-100 mb-4">
        {title}
      </h2>
      {subtitle && (
        <p className="text-rose-600/80 dark:text-rose-300/80 text-lg">
          {subtitle}
        </p>
      )}
      <div className="flex items-center justify-center gap-4 mt-6">
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-rose-300" />
        <Heart className="w-5 h-5 text-rose-400 fill-rose-300" />
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-rose-300" />
      </div>
    </motion.div>
  );
}

// ==================== Hero Section ====================

function HeroSection({ inviteData }: { inviteData: PersonalizedInviteData | null }) {
  const scrollToRSVP = () => {
    document.getElementById("rsvp")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #FDF6F0 0%, #F8E1E7 50%, #FDF6F0 100%)",
      }}
    >
      {/* Floating Hearts Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <FloatingHeart delay={0} duration={4} size={32} left="10%" top="80%" />
        <FloatingHeart delay={1} duration={5} size={24} left="20%" top="70%" />
        <FloatingHeart delay={2} duration={4.5} size={28} left="80%" top="75%" />
        <FloatingHeart delay={0.5} duration={3.5} size={20} left="85%" top="60%" />
        <FloatingHeart delay={1.5} duration={4} size={36} left="15%" top="50%" />
        <FloatingHeart delay={2.5} duration={5} size={22} left="70%" top="85%" />
        <FloatingHeart delay={3} duration={4} size={30} left="50%" top="90%" />
        <FloatingHeart delay={0.8} duration={4.2} size={26} left="90%" top="40%" />
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-rose-200/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-pink-200/20 rounded-full blur-3xl" />
      <div className="absolute top-1/3 right-1/4 w-24 h-24 bg-rose-100/30 rounded-full blur-2xl" />

      {/* Main Content */}
      <motion.div
        className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        {/* Decorative Top Element */}
        <motion.div variants={fadeIn} className="mb-8">
          <div className="flex items-center justify-center gap-3">
            <Heart className="w-6 h-6 text-rose-400 fill-rose-300" />
            <Heart className="w-8 h-8 text-rose-500 fill-rose-400" />
            <Heart className="w-6 h-6 text-rose-400 fill-rose-300" />
          </div>
        </motion.div>

        {/* Main Title */}
        <motion.h1
          variants={fadeInUp}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-serif text-rose-900 dark:text-rose-100 mb-6 tracking-wide"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          我们结婚啦！
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={fadeInUp}
          className="text-xl sm:text-2xl md:text-3xl text-rose-700 dark:text-rose-300 mb-8 font-light"
        >
          {inviteData?.customOpening || "诚挚邀请您见证我们的幸福时刻"}
        </motion.p>

        {inviteData ? (
          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-lg text-rose-700/90 dark:text-rose-300/90 mb-6"
          >
            亲爱的 {inviteData.guestName}（{inviteData.relationshipSide} ·
            {inviteData.relationshipCategory}），诚挚邀请您参加我们的婚礼。
          </motion.p>
        ) : (
          <motion.div
            variants={fadeInUp}
            className="max-w-xl mx-auto mb-6 space-y-3 text-base sm:text-lg text-rose-700/90 dark:text-rose-300/90 leading-relaxed"
          >
            <p>
              孙逢 & 洪丽暖
            </p>
            <p>
              谨定于 2026年5月5日（农历四月初九）
            </p>
            <p>
              在江苏省东台市港汇国际大酒店举行婚礼
            </p>
            <p>
              恭候您的光临
            </p>
          </motion.div>
        )}

        {/* Date */}
        <motion.div
          variants={fadeInUp}
          className="inline-flex items-center gap-3 bg-white/60 dark:bg-rose-950/40 backdrop-blur-sm rounded-full px-8 py-4 mb-10 shadow-lg"
        >
          <Calendar className="w-6 h-6 text-rose-500" />
          <span className="text-xl md:text-2xl font-medium text-rose-800 dark:text-rose-200">
            2026年5月5日
          </span>
        </motion.div>

        {/* CTA Button */}
        <motion.div variants={fadeInUp}>
          <Button
            onClick={scrollToRSVP}
            size="lg"
            className="bg-rose-500 hover:bg-rose-600 text-white px-10 py-6 text-lg rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 group"
          >
            <Heart className="w-5 h-5 mr-2 fill-white group-hover:scale-110 transition-transform" />
            接受邀请
          </Button>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          variants={fadeIn}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="w-8 h-8 text-rose-400" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// ==================== Couple Story Section ====================

function StorySection({ inviteData }: { inviteData: PersonalizedInviteData | null }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const photos = [
    { id: 1, alt: "我们的第一次相遇" },
    { id: 2, alt: "甜蜜的约会时光" },
    { id: 3, alt: "求婚的那一刻" },
  ];

  return (
    <section
      id="story"
      className="py-20 md:py-32 bg-gradient-to-b from-rose-50/50 to-white dark:from-rose-950/20 dark:to-background"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle title="我们的故事" subtitle="从相遇到相守，每一个瞬间都值得铭记" />

        <motion.div
          ref={ref}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={staggerContainer}
        >
          {/* Photo Grid */}
          <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 aspect-[16/9] bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/20 rounded-2xl flex items-center justify-center overflow-hidden group">
              <div className="text-center p-6">
                <Heart className="w-12 h-12 text-rose-300 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <span className="text-rose-600/70 dark:text-rose-400/70 text-sm">照片 1</span>
              </div>
            </div>
            <div className="aspect-square bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/20 rounded-2xl flex items-center justify-center overflow-hidden group">
              <div className="text-center p-4">
                <Heart className="w-10 h-10 text-rose-300 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-rose-600/70 dark:text-rose-400/70 text-sm">照片 2</span>
              </div>
            </div>
            <div className="aspect-square bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/20 rounded-2xl flex items-center justify-center overflow-hidden group">
              <div className="text-center p-4">
                <Heart className="w-10 h-10 text-rose-300 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-rose-600/70 dark:text-rose-400/70 text-sm">照片 3</span>
              </div>
            </div>
          </motion.div>

          {/* Story Text */}
          <motion.div variants={fadeInUp} className="space-y-6">
            <div className="prose prose-rose dark:prose-invert max-w-none [&>p+p]:mt-8">
              <p className="text-lg leading-relaxed text-rose-800/80 dark:text-rose-200/80">
                疫情最后一年的八月底，开学前夕。
                我在一个微信群里看到别人分享了你的相亲帖。
              </p>
              <p className="text-lg leading-relaxed text-rose-800/80 dark:text-rose-200/80">
                看完那篇帖子，我就有了一个很笃定的念头：你就是我要找的人。
                没过多久，我联系上了你；一次次语音、视频和见面时你真诚的陪伴，慢慢打动了我。
              </p>
              <p className="text-lg leading-relaxed text-rose-800/80 dark:text-rose-200/80">
                这些年，我们一起走过很多平凡却珍贵的日子。
                因为一些现实原因，我们没能在宝宝出生前办婚礼。
              </p>
              <p className="text-lg leading-relaxed text-rose-800/80 dark:text-rose-200/80">
                现在，我们终于要带着宝宝一起，把这场迟到却更完整的婚礼办成。
                谢谢你出现在我的生命里，未来的路，我们继续一起走下去。
              </p>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <div className="flex -space-x-2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-300 to-pink-300 flex items-center justify-center text-white font-medium">
                  他
                </div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-300 to-rose-300 flex items-center justify-center text-white font-medium">
                  她
                </div>
              </div>
              <div>
                <p className="text-rose-900 dark:text-rose-100 font-medium">孙逢 & 洪丽暖</p>
                <p className="text-rose-600/70 dark:text-rose-400/70 text-sm">2026年5月5日</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ==================== Wedding Details Section ====================

function DetailsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const details = [
    {
      icon: Calendar,
      title: "时间",
      content: "2026年5月5日",
      subContent: "12:30 宴席开始",
      color: "from-rose-400 to-pink-400",
    },
    {
      icon: MapPin,
      title: "地点",
      content: "江苏省东台市港汇国际大酒店",
      subContent: "婚礼地点：港汇国际大酒店",
      color: "from-pink-400 to-rose-400",
    },
    {
      icon: Clock,
      title: "附近景点",
      content: "麋鹿保护区 · 丹顶鹤保护区",
      subContent: "黄海森林公园",
      color: "from-rose-400 to-pink-400",
    },
    {
      icon: MapPin,
      title: "推荐出行方式",
      content: "近距离：顺风车 / 高铁",
      subContent: "远距离：高铁+顺风车，或飞机到上海后转顺风车/高铁",
      color: "from-pink-400 to-rose-400",
    },
  ];

  return (
    <section
      id="details"
      className="py-20 md:py-32 bg-white dark:bg-background"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle title="婚礼详情" subtitle="期待与您共度这美好的一天" />

        <motion.div
          ref={ref}
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={staggerContainer}
        >
          {details.map((detail, index) => (
            <motion.div
              key={detail.title}
              variants={fadeInUp}
              initial="rest"
              whileHover="hover"
              animate="rest"
            >
              <motion.div
                className="relative bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/20 rounded-3xl p-8 h-full border border-rose-100 dark:border-rose-900/30"
                variants={cardHover}
              >
                {/* Icon */}
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${detail.color} flex items-center justify-center mb-6 shadow-lg`}
                >
                  <detail.icon className="w-8 h-8 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-rose-900 dark:text-rose-100 mb-3">
                  {detail.title}
                </h3>
                <p className="text-2xl font-medium text-rose-700 dark:text-rose-300 mb-2">
                  {detail.content}
                </p>
                <p className="text-rose-600/70 dark:text-rose-400/70">
                  {detail.subContent}
                </p>

                {/* Decorative Corner */}
                <div className="absolute top-4 right-4">
                  <Heart className="w-5 h-5 text-rose-200 dark:text-rose-800 fill-rose-100 dark:fill-rose-900/30" />
                </div>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function MemoryCarousel({
  title,
  photos,
}: {
  title: string;
  photos: MemoryPhotoItem[];
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [photos.length]);

  const hasPhotos = photos.length > 0;
  const current = hasPhotos ? photos[index % photos.length] : null;

  const prev = () => {
    if (!hasPhotos) return;
    setIndex((prevIndex) => (prevIndex - 1 + photos.length) % photos.length);
  };

  const next = () => {
    if (!hasPhotos) return;
    setIndex((prevIndex) => (prevIndex + 1) % photos.length);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-serif text-rose-900 dark:text-rose-100">{title}</h3>
      <div className="rounded-3xl border border-rose-100 bg-white/70 p-4 shadow-lg dark:border-rose-900/30 dark:bg-rose-950/30">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/20">
          {current ? (
            <img src={current.url} alt={current.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-rose-600/70 dark:text-rose-300/70">
              请在 CMS 上传照片后展示
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={prev}
            disabled={!hasPhotos}
            className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-700 disabled:opacity-40 dark:border-rose-700 dark:text-rose-200"
          >
            上一张
          </button>
          <div className="text-center text-sm text-rose-700/80 dark:text-rose-200/80">
            <div>{current?.title || "未上传"}</div>
            {current?.description ? <div className="mt-1 text-xs opacity-80">{current.description}</div> : null}
          </div>
          <button
            type="button"
            onClick={next}
            disabled={!hasPhotos}
            className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-700 disabled:opacity-40 dark:border-rose-700 dark:text-rose-200"
          >
            下一张
          </button>
        </div>
      </div>
    </div>
  );
}

function MemoriesSection({ photos }: { photos: MemoryPhotoData }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="gallery"
      className="py-20 md:py-32 bg-gradient-to-b from-white to-rose-50/30 dark:from-background dark:to-rose-950/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle title="我们的回忆" subtitle="在后台上传照片后，这里会自动更新" />

        <motion.div
          ref={ref}
          className="space-y-10"
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={staggerContainer}
        >
          <motion.div variants={fadeInUp}>
            <MemoryCarousel title="孙逢和洪丽暖" photos={photos.couple} />
          </motion.div>
          <motion.div variants={fadeInUp}>
            <MemoryCarousel title="宝宝" photos={photos.baby} />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ==================== RSVP Form Section ====================

function RSVPSection({
  inviteData,
}: {
  inviteData: PersonalizedInviteData | null;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const [formData, setFormData] = useState({
    name: "",
    attendance: "attending",
    guests: "",
    phone: "",
    arrivalPlan: "same_day",
    needsHotel: "no",
    hotelNights: "none",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inviteCode = inviteData?.inviteCode || "";

  useEffect(() => {
    if (inviteData?.guestName) {
      setFormData((prev) => ({ ...prev, name: inviteData.guestName }));
    }
  }, [inviteData?.guestName]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = "请输入您的姓名";
    }
    if (!formData.guests) {
      newErrors.guests = "请选择参加人数";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          guestCount: formData.guests,
          phone: formData.phone,
          message: formData.message,
          status: formData.attendance,
          inviteCode,
          arrivalPlan: formData.arrivalPlan,
          needsHotel: formData.needsHotel === "yes",
          hotelNights: formData.hotelNights,
        }),
      });

      if (response.ok) {
        setIsSubmitted(true);
      } else {
        const result = await response.json();
        setErrors((prev) => ({
          ...prev,
          guests: typeof result.error === "string" ? result.error : "提交失败，请稍后重试",
        }));
      }
    } catch (error) {
      console.error("RSVP submission error:", error);
    }
    setIsSubmitting(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <section
      id="rsvp"
      className="py-20 md:py-32 bg-gradient-to-b from-rose-50/30 to-rose-100/30 dark:from-rose-950/10 dark:to-rose-950/20"
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle title="请回复" subtitle="期待与您相见" />

        <motion.div
          ref={ref}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={fadeInUp}
        >
          <AnimatePresence mode="wait">
            {!isSubmitted ? (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                className="bg-white/80 dark:bg-rose-950/40 backdrop-blur-sm rounded-3xl p-8 md:p-10 shadow-xl border border-rose-100 dark:border-rose-900/30"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="space-y-6">
                  {/* Name Field */}
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-rose-900 dark:text-rose-100 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      姓名 <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="请输入您的姓名"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      className={cn(
                        "bg-rose-50/50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 focus:border-rose-400 focus:ring-rose-400",
                        errors.name && "border-red-400 focus:border-red-400 focus:ring-red-400"
                      )}
                    />
                    {errors.name && (
                      <p className="text-red-500 text-sm">{errors.name}</p>
                    )}
                  </div>

                  {/* Guests Field */}
                  <div className="space-y-2">
                    <Label htmlFor="attendance" className="text-rose-900 dark:text-rose-100">
                      是否出席
                    </Label>
                    <Select
                      value={formData.attendance}
                      onValueChange={(value) => handleChange("attendance", value)}
                    >
                      <SelectTrigger className="bg-rose-50/50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 focus:border-rose-400 focus:ring-rose-400">
                        <SelectValue placeholder="请选择是否出席" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="attending">会来参加</SelectItem>
                        <SelectItem value="not_attending">不能参加</SelectItem>
                        <SelectItem value="pending">暂未确定</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Guests Field */}
                  <div className="space-y-2">
                    <Label htmlFor="guests" className="text-rose-900 dark:text-rose-100 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      参加人数 <span className="text-rose-500">*</span>
                    </Label>
                    <Select
                      value={formData.guests}
                      onValueChange={(value) => handleChange("guests", value)}
                    >
                      <SelectTrigger
                        className={cn(
                          "bg-rose-50/50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 focus:border-rose-400 focus:ring-rose-400",
                          errors.guests && "border-red-400 focus:border-red-400 focus:ring-red-400"
                        )}
                      >
                        <SelectValue placeholder="请选择参加人数" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          { length: Math.max(inviteData?.maxGuestCount || 5, 1) },
                          (_, i) => i + 1
                        ).map((num) => (
                          <SelectItem key={num} value={String(num)}>
                            {num} 人
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.guests && (
                      <p className="text-red-500 text-sm">{errors.guests}</p>
                    )}
                  </div>

                  {/* Phone Field */}
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-rose-900 dark:text-rose-100 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      联系电话 <span className="text-rose-400 text-sm">(选填)</span>
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="请输入您的联系电话"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      className="bg-rose-50/50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 focus:border-rose-400 focus:ring-rose-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="arrivalPlan" className="text-rose-900 dark:text-rose-100">
                      行程安排
                    </Label>
                    <p className="text-xs text-rose-600/80 dark:text-rose-300/80">
                      对外地来宾提供酒店，可选前一晚或后一晚住宿
                    </p>
                    <Select
                      value={formData.arrivalPlan}
                      onValueChange={(value) => handleChange("arrivalPlan", value)}
                    >
                      <SelectTrigger className="bg-rose-50/50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 focus:border-rose-400 focus:ring-rose-400">
                        <SelectValue placeholder="请选择您的行程安排" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same_day">婚礼当天到、当天走</SelectItem>
                        <SelectItem value="arrive_early">会提前来</SelectItem>
                        <SelectItem value="leave_late">会晚些走</SelectItem>
                        <SelectItem value="both">提前来并晚些走</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="needsHotel" className="text-rose-900 dark:text-rose-100">
                      住宿安排（仅外地来宾）
                    </Label>
                    <Select
                      value={formData.needsHotel}
                      onValueChange={(value) => handleChange("needsHotel", value)}
                    >
                      <SelectTrigger className="bg-rose-50/50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 focus:border-rose-400 focus:ring-rose-400">
                        <SelectValue placeholder="是否需要酒店" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">不需要酒店</SelectItem>
                        <SelectItem value="yes">需要酒店</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.needsHotel === "yes" && (
                    <div className="space-y-2">
                      <Label htmlFor="hotelNights" className="text-rose-900 dark:text-rose-100">
                        酒店安排
                      </Label>
                      <Select
                        value={formData.hotelNights}
                        onValueChange={(value) => handleChange("hotelNights", value)}
                      >
                        <SelectTrigger className="bg-rose-50/50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 focus:border-rose-400 focus:ring-rose-400">
                          <SelectValue placeholder="请选择住前一晚/后一晚" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="before">前一晚</SelectItem>
                          <SelectItem value="after">后一晚</SelectItem>
                          <SelectItem value="both">前后两晚</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Message Field */}
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-rose-900 dark:text-rose-100 flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" />
                      祝福语 <span className="text-rose-400 text-sm">(选填)</span>
                    </Label>
                    <Textarea
                      id="message"
                      placeholder="写下您对我们的祝福..."
                      value={formData.message}
                      onChange={(e) => handleChange("message", e.target.value)}
                      rows={4}
                      className="bg-rose-50/50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 focus:border-rose-400 focus:ring-rose-400 resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white py-6 rounded-xl text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-70"
                  >
                    {isSubmitting ? (
                      <motion.div
                        className="flex items-center gap-2"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <Sparkles className="w-5 h-5" />
                        提交中...
                      </motion.div>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Send className="w-5 h-5" />
                        提交回复
                      </span>
                    )}
                  </Button>
                </div>
              </motion.form>
            ) : (
              <motion.div
                key="success"
                className="bg-white/80 dark:bg-rose-950/40 backdrop-blur-sm rounded-3xl p-10 md:p-14 shadow-xl border border-rose-100 dark:border-rose-900/30 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                {/* Confetti Animation */}
                <div className="relative mb-6">
                  <motion.div
                    className="w-24 h-24 mx-auto bg-gradient-to-br from-rose-400 to-pink-400 rounded-full flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  >
                    <Check className="w-12 h-12 text-white" />
                  </motion.div>
                  {/* Floating hearts for confetti effect */}
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute"
                      style={{
                        left: `${20 + i * 12}%`,
                        top: "50%",
                      }}
                      initial={{ opacity: 0, y: 0, scale: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        y: [-20, -80 - Math.random() * 40],
                        x: [0, (Math.random() - 0.5) * 60],
                        scale: [0.5, 1, 0.5],
                        rotate: [0, Math.random() * 360],
                      }}
                      transition={{
                        duration: 2,
                        delay: i * 0.1,
                        ease: "easeOut",
                      }}
                    >
                      <Heart
                        size={16 + Math.random() * 16}
                        className={[
                          "text-rose-400 fill-rose-300",
                          "text-pink-400 fill-pink-300",
                          "text-rose-300 fill-rose-200",
                        ][i % 3]}
                      />
                    </motion.div>
                  ))}
                </div>

                <motion.h3
                  className="text-2xl md:text-3xl font-serif text-rose-900 dark:text-rose-100 mb-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  感谢您的回复！
                </motion.h3>
                <motion.p
                  className="text-rose-600/80 dark:text-rose-300/80 text-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  期待在婚礼上与您相见
                </motion.p>

                <motion.div
                  className="mt-8 flex justify-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  {[...Array(5)].map((_, i) => (
                    <Heart
                      key={i}
                      className="w-5 h-5 text-rose-300 fill-rose-200"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}

// ==================== Footer Component ====================

function Footer() {
  return (
    <footer className="py-12 bg-gradient-to-b from-rose-100/50 to-rose-200/50 dark:from-rose-950/30 dark:to-rose-950/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Decorative Hearts */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <Heart className="w-5 h-5 text-rose-300 fill-rose-200" />
            <Heart className="w-7 h-7 text-rose-400 fill-rose-300" />
            <Heart className="w-5 h-5 text-rose-300 fill-rose-200" />
          </div>

          {/* Names */}
          <h3
            className="text-2xl md:text-3xl font-serif text-rose-900 dark:text-rose-100 mb-4"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            孙逢 & 洪丽暖
          </h3>

          {/* Date */}
          <p className="text-rose-600/80 dark:text-rose-300/80 mb-6">
            2026年5月5日 · 我们结婚啦
          </p>

          {/* Divider */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-rose-300" />
            <Sparkles className="w-4 h-4 text-rose-400" />
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-rose-300" />
          </div>

          {/* Copyright */}
          <p className="text-rose-500/60 dark:text-rose-400/60 text-sm">
            Made with{" "}
            <Heart className="w-4 h-4 inline text-rose-400 fill-rose-400" /> for
            our special day
          </p>
        </div>
      </div>
    </footer>
  );
}

// ==================== Navigation Component ====================

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { label: "首页", href: "#hero" },
    { label: "我们的故事", href: "#story" },
    { label: "婚礼详情", href: "#details" },
    { label: "我们的回忆", href: "#gallery" },
    { label: "请回复", href: "#rsvp" },
  ];

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    element?.scrollIntoView({ behavior: "smooth" });
    setIsMobileMenuOpen(false);
  };

  return (
    <motion.nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-white/90 dark:bg-background/90 backdrop-blur-md shadow-sm"
          : "bg-transparent"
      )}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <motion.a
            href="#hero"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection("#hero");
            }}
            className="flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
          >
            <Heart className="w-6 h-6 text-rose-500 fill-rose-400" />
            <span
              className={cn(
                "text-lg font-serif font-medium transition-colors",
                isScrolled
                  ? "text-rose-900 dark:text-rose-100"
                  : "text-rose-800 dark:text-rose-200"
              )}
            >
              我们结婚啦
            </span>
          </motion.a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <motion.a
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(item.href);
                }}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-rose-500",
                  isScrolled
                    ? "text-rose-700 dark:text-rose-300"
                    : "text-rose-800 dark:text-rose-200"
                )}
                whileHover={{ y: -2 }}
              >
                {item.label}
              </motion.a>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <div className="w-6 h-5 relative flex flex-col justify-between">
              <motion.span
                className={cn(
                  "w-full h-0.5 rounded-full transition-colors",
                  isScrolled
                    ? "bg-rose-700 dark:bg-rose-300"
                    : "bg-rose-800 dark:bg-rose-200"
                )}
                animate={
                  isMobileMenuOpen
                    ? { rotate: 45, y: 9 }
                    : { rotate: 0, y: 0 }
                }
              />
              <motion.span
                className={cn(
                  "w-full h-0.5 rounded-full transition-colors",
                  isScrolled
                    ? "bg-rose-700 dark:bg-rose-300"
                    : "bg-rose-800 dark:bg-rose-200"
                )}
                animate={isMobileMenuOpen ? { opacity: 0 } : { opacity: 1 }}
              />
              <motion.span
                className={cn(
                  "w-full h-0.5 rounded-full transition-colors",
                  isScrolled
                    ? "bg-rose-700 dark:bg-rose-300"
                    : "bg-rose-800 dark:bg-rose-200"
                )}
                animate={
                  isMobileMenuOpen
                    ? { rotate: -45, y: -9 }
                    : { rotate: 0, y: 0 }
                }
              />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="md:hidden bg-white/95 dark:bg-background/95 backdrop-blur-md border-t border-rose-100 dark:border-rose-900/30"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="px-4 py-4 space-y-2">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(item.href);
                  }}
                  className="block py-3 px-4 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// ==================== Main Page Component ====================

export function WeddingInvitationPage({
  initialInviteCode,
}: {
  initialInviteCode?: string;
} = {}) {
  const [inviteData, setInviteData] = useState<PersonalizedInviteData | null>(null);
  const [memoryPhotos, setMemoryPhotos] = useState<MemoryPhotoData>({ couple: [], baby: [] });

  useEffect(() => {
    const code = initialInviteCode || "";

    if (!code) {
      return;
    }

    const controller = new AbortController();
    const loadInvitation = async () => {
      try {
        const response = await fetch(`/api/invitation?code=${encodeURIComponent(code)}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        if (payload?.success && payload?.data) {
          setInviteData(payload.data as PersonalizedInviteData);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to load invitation personalization:", error);
        }
      }
    };

    loadInvitation();
    return () => controller.abort();
  }, [initialInviteCode]);

  useEffect(() => {
    const controller = new AbortController();

    const loadMemories = async () => {
      try {
        const response = await fetch("/api/memories", { signal: controller.signal });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          success?: boolean;
          data?: {
            couple?: MemoryPhotoItem[];
            baby?: MemoryPhotoItem[];
          };
        };

        if (payload.success && payload.data) {
          setMemoryPhotos({
            couple: Array.isArray(payload.data.couple) ? payload.data.couple : [],
            baby: Array.isArray(payload.data.baby) ? payload.data.baby : [],
          });
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to load memories:", error);
        }
      }
    };

    void loadMemories();

    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-screen bg-background">
      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <HeroSection inviteData={inviteData} />

      {/* Couple Story Section */}
      <StorySection inviteData={inviteData} />

      {/* Wedding Details Section */}
      <DetailsSection />

      <MemoriesSection photos={memoryPhotos} />

      {/* RSVP Form Section */}
      <RSVPSection inviteData={inviteData} />

      {/* Footer */}
      <Footer />
    </main>
  );
}

export default function WeddingInvitationHomePage() {
  return <WeddingInvitationPage />;
}
