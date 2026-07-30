interface PixelTabsProps {
  tabs: string[];
  selected: string;
  onSelect: (tab: string) => void;
}

export function PixelTabs({ tabs, selected, onSelect }: PixelTabsProps) {
  return (
    <div className="pixel-tabs" role="tablist" aria-label="Workspace layer view">
      {tabs.map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={selected === tab}
          className="pixel-tabs__tab"
          onClick={() => onSelect(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
