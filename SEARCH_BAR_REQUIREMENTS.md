# 搜索框和Logo布局需求文档

## 核心原则
**所有修改必须严格遵守此文档，确保修改一个功能时不影响其他功能。**

## 1. 主内容区域对齐基准
- **主内容容器结构**：`max-w-7xl mx-auto px-2 sm:px-4`
- **这是所有对齐的基准**，搜索框必须与此对齐

## 2. Logo位置和间距要求

### 2.1 Logo位置（主页状态，无选中物品时）
- **移动端** (< 640px)：
  - `top-2.5 left-2` (8px from top, 8px from left)
  - `w-8 h-8` (32px × 32px)
  - Logo在搜索框内（搜索框有足够左边距容纳logo）

- **桌面端** (≥ 640px, < 890px)：
  - `top-4 left-4` (16px from top, 16px from left)
  - `w-12 h-12` (48px × 48px)
  - Logo在搜索框外，固定定位

- **大桌面端** (≥ 890px)：
  - `top-4 left-6` (16px from top, **24px from left** - 增加margin)
  - `w-12 h-12` (48px × 48px)
  - Logo在搜索框外，固定定位

### 2.2 Logo位置（物品详情页，有选中物品时）
- **移动端**：隐藏（在第二排显示）
- **桌面端** (≥ 890px)：
  - `top-4 left-6` (16px from top, 24px from left)
  - `w-12 h-12` (48px × 48px)

### 2.3 Logo间距要求
- **必须**：左上角logo的margin要足够，至少 `left-6` (24px) 在桌面端
- **不能**：在760px宽度时logo与搜索框重叠

## 3. 搜索框对齐要求

### 3.1 对齐策略
- **移动端** (< 640px)：自适应布局，不需要与主内容对齐
  - 搜索框可以使用 `pl-12` 为logo预留空间
  - Logo在搜索框内
  
- **PC端** (≥ 640px)：必须与主内容对齐
  - 外层容器padding：`px-4` (16px) - 与主内容一致
  - 内层容器：`max-w-7xl mx-auto` - 与主内容一致
  - 这确保搜索框容器与主内容容器完全对齐

### 3.2 搜索框内容对齐（仅PC端）
- **PC端**：搜索框内容（input）的左边缘必须与主内容区域的左边缘对齐
- **不能**使用额外的margin或padding来偏移搜索框内容
- **不能**使用占位元素（spacer div）来创建空间

### 3.3 避免重叠策略
- 在sm及以上（≥640px），logo在 `left-4` (16px)，宽度 `w-12` (48px)
- Logo占据位置：16px - 64px
- 搜索框从主内容左边缘（16px）开始
- **解决方案**：Logo的z-index (60) 高于搜索框 (50)，允许logo显示在搜索框上方
- **或者**：调整logo位置，使其不影响搜索框的对齐

## 4. 搜索框宽度要求

### 4.1 最小宽度
- **移动端** (< 640px)：`flex-1` (自适应)
- **桌面端** (≥ 640px, < 890px)：`sm:min-w-[400px]`
- **大桌面端** (≥ 890px)：`mid:min-w-[520px]`

### 4.2 宽度目标
- **必须**：在默认电脑宽度（≥ 640px）时，placeholder文字 "多關鍵詞用空格分隔（例：豹 褲）" 必须能完整显示
- **当前placeholder**：`"多關鍵詞用空格分隔（例：豹 褲）"`
- **测试**：确保在640px宽度时文字不换行

## 5. 响应式断点
- `sm`: 640px
- `mid`: 890px (自定义断点)
- `detail`: 980px (自定义断点)

## 6. 物品详情页特殊处理
- 当 `selectedItem` 存在时，搜索框布局可以不同
- 但主页状态（无选中物品）必须严格遵守以上规则

## 7. 实现检查清单

修改代码前必须确认：
- [ ] 搜索框外层容器使用 `px-2 sm:px-4`
- [ ] 搜索框内层容器使用 `max-w-7xl mx-auto`
- [ ] 搜索框内容没有额外的margin或padding偏移
- [ ] 没有占位元素（spacer div）影响对齐
- [ ] Logo在桌面端使用 `left-6` (24px) 或更多
- [ ] 搜索框最小宽度满足placeholder显示要求
- [ ] 在760px宽度测试时logo不与搜索框重叠
- [ ] 搜索框左边缘与主内容左边缘对齐

## 8. 当前主内容结构（参考）
```jsx
<div className="max-w-7xl mx-auto px-2 sm:px-4">
  {/* 主内容 */}
</div>
```

## 9. 目标搜索框结构（主页状态）
```jsx
<div className="fixed ... px-2 sm:px-4">
  <div className="max-w-7xl mx-auto flex ...">
    <div className="flex ...">
      {/* 搜索框 - 直接从容器左边缘开始，与主内容对齐 */}
      <div className="flex-1 sm:min-w-[400px] mid:min-w-[520px]">
        <SearchBar />
      </div>
    </div>
  </div>
</div>
```
