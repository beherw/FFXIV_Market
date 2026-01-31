# OCR 組件樣式整理

本文檔整理了 OCR 按鈕和模態框的所有 CSS 類名，方便自定義樣式。

## 1. OCR 主按鈕

### 按鈕容器
```tsx
className="flex items-center justify-center gap-1.5 px-2.5 mid:px-3 py-1.5 mid:py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs mid:text-sm font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
```

**樣式說明：**
- `flex items-center justify-center gap-1.5` - Flex 布局，垂直居中，間距 1.5
- `px-2.5 mid:px-3 py-1.5 mid:py-2` - 響應式 padding
- `bg-gradient-to-r from-purple-600 to-indigo-600` - 紫色到靛藍色漸變背景
- `hover:from-purple-700 hover:to-indigo-700` - Hover 時漸變變深
- `text-white text-xs mid:text-sm` - 白色文字，響應式字體大小
- `font-semibold rounded-lg` - 半粗體，圓角
- `transition-all duration-200` - 200ms 過渡動畫
- `shadow-lg hover:shadow-xl` - 陰影效果
- `disabled:opacity-50 disabled:cursor-not-allowed` - 禁用狀態樣式

### 載入中旋轉圖標
```tsx
className="animate-spin rounded-full h-3 w-3 mid:h-3.5 mid:w-3.5 border-2 border-white border-t-transparent"
```

### 載入中文字
```tsx
className="hidden mid:inline"
```

### 按鈕圖標 (SVG)
```tsx
className="w-3.5 h-3.5 mid:w-4 mid:h-4"
```

### 按鈕文字
```tsx
className="hidden mid:inline"
```

---

## 2. 模態框背景遮罩

```tsx
className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
```

**樣式說明：**
- `fixed inset-0` - 固定定位，全屏覆蓋
- `z-[100]` - 高層級
- `bg-black/60` - 60% 透明度的黑色背景
- `backdrop-blur-sm` - 背景模糊效果
- `flex items-center justify-center` - 居中布局
- `p-4` - 16px padding

---

## 3. 模態框主容器

```tsx
className="bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 rounded-lg border-2 border-purple-500/50 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
```

**樣式說明：**
- `bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900` - 從左上到右下的漸變（深灰→紫色→深灰）
- `rounded-lg` - 大圓角
- `border-2 border-purple-500/50` - 2px 紫色半透明邊框
- `shadow-2xl` - 大陰影
- `max-w-2xl w-full` - 最大寬度 42rem，全寬
- `max-h-[90vh]` - 最大高度 90vh
- `overflow-hidden flex flex-col` - 隱藏溢出，垂直 Flex 布局

**內聯樣式：**
```tsx
style={{
  maxHeight: '90vh',
  maxWidth: '42rem',
}}
```

---

## 4. 模態框標題欄

```tsx
className="flex items-center justify-between p-4 sm:p-6 border-b border-purple-500/30 flex-shrink-0"
```

**樣式說明：**
- `flex items-center justify-between` - Flex 布局，兩端對齊
- `p-4 sm:p-6` - 響應式 padding
- `border-b border-purple-500/30` - 底部紫色半透明邊框
- `flex-shrink-0` - 不允許縮小

### 標題文字
```tsx
className="text-lg sm:text-xl font-semibold text-white"
```

### 關閉按鈕
```tsx
className="text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1"
```

### 關閉按鈕圖標 (SVG)
```tsx
className="w-5 h-5"
```

---

## 5. 模態框內容區域

```tsx
className="flex-1 overflow-y-auto p-4 sm:p-6"
style={{ minHeight: 0 }}
```

**樣式說明：**
- `flex-1` - 佔據剩餘空間
- `overflow-y-auto` - 垂直滾動
- `p-4 sm:p-6` - 響應式 padding
- `minHeight: 0` - 允許 Flex 子元素縮小

---

## 6. 拖放區域

### 基礎樣式
```tsx
className="border-2 border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer transition-all w-full box-border"
```

**樣式說明：**
- `border-2 border-dashed` - 2px 虛線邊框
- `rounded-lg` - 圓角
- `p-6 sm:p-8` - 響應式 padding
- `text-center` - 文字居中
- `cursor-pointer` - 指針游標
- `transition-all` - 所有屬性過渡動畫
- `w-full box-border` - 全寬，盒模型包含邊框

### 拖拽狀態（isDragging）
```tsx
className="border-purple-400 bg-purple-900/20"
```

### 正常狀態（hover）
```tsx
className="border-purple-500/50 hover:border-purple-400 hover:bg-purple-900/10"
```

### 處理中狀態（isProcessing）
```tsx
className="cursor-not-allowed opacity-50"
```

---

## 7. 預覽圖片容器

```tsx
className="space-y-4 w-full"
```

### 預覽圖片
```tsx
className="max-w-full max-h-64 mx-auto rounded-lg shadow-lg object-contain"
```

**樣式說明：**
- `max-w-full` - 最大寬度 100%
- `max-h-64` - 最大高度 16rem (256px)
- `mx-auto` - 水平居中
- `rounded-lg` - 圓角
- `shadow-lg` - 陰影
- `object-contain` - 保持比例，完整顯示

---

## 8. 進度條容器

```tsx
className="space-y-2 w-full"
```

### 進度條背景
```tsx
className="w-full bg-gray-700 rounded-full h-2.5"
```

### 進度條填充
```tsx
className="bg-purple-500 h-2.5 rounded-full transition-all duration-300"
style={{ width: `${progress * 100}%` }}
```

### 進度文字
```tsx
className="text-sm text-gray-400"
```

---

## 9. 空狀態（無圖片時）

### 容器
```tsx
className="space-y-4 w-full"
```

### 圖標 (SVG)
```tsx
className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-purple-400"
```

### 文字容器
```tsx
className="w-full"
```

### 主標題
```tsx
className="text-white font-medium mb-2 text-sm sm:text-base"
```

### 副標題
```tsx
className="text-xs sm:text-sm text-gray-400 mb-2"
```

### 鍵盤按鍵樣式 (kbd)
```tsx
className="px-2 py-1 bg-slate-800 rounded text-xs"
```

### 說明文字
```tsx
className="text-xs text-gray-500"
```

---

## 10. 提示文字區域

```tsx
className="mt-4 text-center"
```

### 提示文字
```tsx
className="text-xs text-gray-500"
```

---

## 顏色變數參考

如果需要統一修改顏色，以下是主要使用的顏色：

- **紫色系：**
  - `purple-400` - 拖拽狀態邊框
  - `purple-500` - 進度條、邊框
  - `purple-600` - 按鈕背景（起始）
  - `purple-700` - 按鈕 hover（起始）
  - `purple-900/20` - 拖拽狀態背景
  - `purple-900/10` - hover 背景
  - `purple-900/30` - 模態框漸變中間色

- **灰色系：**
  - `gray-400` - 關閉按鈕、進度文字
  - `gray-500` - 提示文字
  - `gray-700` - 進度條背景
  - `slate-800` - 鍵盤按鍵背景
  - `slate-900` - 模態框背景

- **其他：**
  - `indigo-600` - 按鈕背景（結束）
  - `indigo-700` - 按鈕 hover（結束）
  - `white` - 按鈕文字、標題
  - `black/60` - 模態框遮罩

---

## 響應式斷點

- `mid:` - 中等屏幕（自定義斷點，通常約 640px+）
- `sm:` - 小屏幕（Tailwind 默認 640px+）

---

## 修改建議

1. **修改按鈕顏色：** 更改 `from-purple-600 to-indigo-600` 為其他漸變色
2. **修改模態框背景：** 調整 `from-slate-900 via-purple-900/30 to-slate-900`
3. **修改邊框顏色：** 更改所有 `border-purple-500/50` 相關類名
4. **修改圓角大小：** 將 `rounded-lg` 改為 `rounded-md` 或 `rounded-xl`
5. **修改陰影：** 調整 `shadow-lg`、`shadow-xl`、`shadow-2xl`
