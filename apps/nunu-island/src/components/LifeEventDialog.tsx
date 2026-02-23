import { useState, useRef } from 'react';
// LifeEventDialog component
import { X, Calendar, ImageIcon, Upload, Trash2, Heart, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { LifeEvent } from '@/data/lifeLine';

interface LifeEventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Omit<LifeEvent, 'id' | 'createdAt'>) => void;
  onDelete?: (id: string) => void;
  initialType?: 'positive' | 'negative';
  editingEvent?: LifeEvent | null;
}

export function LifeEventDialog({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialType = 'negative',
  editingEvent,
}: LifeEventDialogProps) {
  const [date, setDate] = useState(editingEvent?.date || new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState(editingEvent?.title || '');
  const [description, setDescription] = useState(editingEvent?.description || '');
  const [type, setType] = useState<'positive' | 'negative'>(editingEvent?.type || initialType);
  const [images, setImages] = useState<string[]>(editingEvent?.images || []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!title.trim() || !date) return;

    onSave({
      date,
      title: title.trim(),
      description: description.trim(),
      type,
      images,
    });

    // 重置表单
    if (!editingEvent) {
      setDate(new Date().toISOString().split('T')[0]);
      setTitle('');
      setDescription('');
      setType(initialType);
      setImages([]);
    }

    onClose();
  };

  const handleDelete = () => {
    if (editingEvent && onDelete) {
      onDelete(editingEvent.id);
      onClose();
    }
  };

  const isAbove = type === 'positive';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingEvent ? (
              <>
                <span className="text-gray-400">编辑</span>
                <span className={isAbove ? 'text-rose-600' : 'text-emerald-600'}>
                  {isAbove ? '被伤害的时刻' : '活下来的时刻'}
                </span>
              </>
            ) : (
              <>
                <span className="text-gray-400">添加</span>
                <span className={isAbove ? 'text-rose-600' : 'text-emerald-600'}>
                  {isAbove ? '被伤害的时刻' : '活下来的时刻'}
                </span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-4">
          {/* 类型选择 */}
          {!editingEvent && (
            <div>
              <label className="text-sm text-gray-600 mb-2 block">这是什么样的时刻？</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setType('positive')}
                  className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all ${
                    type === 'positive'
                      ? 'bg-rose-100 text-rose-600 border-2 border-rose-300'
                      : 'bg-gray-100 text-gray-500 border-2 border-transparent'
                  }`}
                >
                  <Heart className="w-5 h-5" />
                  被伤害的时刻
                </button>
                <button
                  onClick={() => setType('negative')}
                  className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all ${
                    type === 'negative'
                      ? 'bg-emerald-100 text-emerald-600 border-2 border-emerald-300'
                      : 'bg-gray-100 text-gray-500 border-2 border-transparent'
                  }`}
                >
                  <Shield className="w-5 h-5" />
                  活下来的时刻
                </button>
              </div>
            </div>
          )}

          {/* 日期 */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              发生在什么时候？
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full"
            />
          </div>

          {/* 标题 */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">标题</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isAbove ? '例如：奶奶拒绝了我' : '例如：今天我对宝宝笑了'}
              className="w-full"
            />
          </div>

          {/* 描述 */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">详细描述</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isAbove 
                ? '描述当时发生了什么，你的感受是什么...' 
                : '描述这个时刻，它为什么重要...'}
              rows={4}
            />
          </div>

          {/* 图片上传 */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              相关图片（可选）
            </label>
            
            {/* 已上传图片 */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {images.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={img}
                      alt={`图片 ${index + 1}`}
                      className="w-full h-20 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* 上传按钮 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-rose-300 hover:text-rose-500 transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              上传图片
            </button>
          </div>

          {/* 按钮 */}
          <div className="flex gap-3 pt-2">
            {editingEvent && onDelete && (
              <Button
                variant="outline"
                className="flex items-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4" />
                删除
              </Button>
            )}
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              取消
            </Button>
            <Button
              className={`flex-1 ${isAbove ? 'gradient-rose' : 'bg-gradient-to-r from-emerald-400 to-teal-500'} text-white`}
              onClick={handleSave}
              disabled={!title.trim() || !date}
            >
              {editingEvent ? '保存' : '添加'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
