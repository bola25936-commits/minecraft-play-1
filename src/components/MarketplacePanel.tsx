import React, { useEffect, useState } from 'react';
import {
  Check,
  Coins,
  Cpu,
  Eye,
  Globe,
  Package,
  Palette,
  Play,
  ShieldCheck,
  Sparkles,
  Store,
  UserCheck,
} from 'lucide-react';
import {
  BehaviorPackId,
  BONUS_MINEDOLLARS,
  BONUS_MINEDOLLARS_STR,
  formatMineDollarsCompact,
  formatMineDollarsExact,
  MARKETPLACE_BEHAVIOR_PACKS,
  MARKETPLACE_BUNDLES,
  MARKETPLACE_RESOURCE_PACKS,
  MARKETPLACE_SKIN_PACKS,
  MarketplaceBundleItem,
  MarketplaceCategory,
  MarketplaceItem,
  MarketplaceResourceItem,
  MarketplaceSkinItem,
} from '../game/marketplace';
import { TexturePackId } from '../game/textures';
import { BLOCK_DEFS } from '../game/types';
import {
  BehaviorPackArtwork,
  BundleArtwork,
  ResourcePackShowcaseCanvas,
  SkinFullShowcase,
} from './MarketplaceVisuals';

interface MarketplacePanelProps {
  balance: bigint;
  ownedIds: string[];
  activeResourcePack: TexturePackId;
  activeBehaviorPacks: BehaviorPackId[];
  activeSkinId: string;
  onBuyItem: (item: MarketplaceItem) => void;
  onEquipResourcePack: (packId: TexturePackId) => void;
  onToggleBehaviorPack: (packId: BehaviorPackId) => void;
  onEquipSkinFromMarketplace: (skinItem: MarketplaceSkinItem) => void;
  onLaunchMarketplaceWorld: (bundle: MarketplaceBundleItem) => void;
  onClaimBonusMineDollars: () => void;
}

export const MarketplacePanel: React.FC<MarketplacePanelProps> = ({
  balance,
  ownedIds,
  activeResourcePack,
  activeBehaviorPacks,
  activeSkinId,
  onBuyItem,
  onEquipResourcePack,
  onToggleBehaviorPack,
  onEquipSkinFromMarketplace,
  onLaunchMarketplaceWorld,
  onClaimBonusMineDollars,
}) => {
  const [category, setCategory] = useState<MarketplaceCategory>('resource');
  const [previewPackId, setPreviewPackId] = useState<TexturePackId>(activeResourcePack);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setPreviewPackId(activeResourcePack);
  }, [activeResourcePack]);

  const ownedSet = new Set(ownedIds);
  const activeBehaviorSet = new Set(activeBehaviorPacks);

  const previewResource =
    MARKETPLACE_RESOURCE_PACKS.find((p) => p.packId === previewPackId) ??
    MARKETPLACE_RESOURCE_PACKS[0];
  const previewOwned = ownedSet.has(previewResource.id) || previewResource.price === 0n;
  const previewEquipped = activeResourcePack === previewResource.packId;
  const previewAffordable = balance >= previewResource.price;

  const triggerNotice = (msg: string) => {
    setNotice(msg);
  };

  const handlePurchase = (item: MarketplaceItem) => {
    if (balance < item.price) {
      triggerNotice('Not enough MineDollars for this item.');
      return;
    }
    onBuyItem(item);
    triggerNotice(
      item.price === 0n
        ? `Equipped ${item.name}!`
        : `Purchased ${item.name} for ${formatMineDollarsExact(item.price)} MineDollars!`
    );
  };

  const renderResourceCard = (item: MarketplaceResourceItem) => {
    const owned = ownedSet.has(item.id) || item.price === 0n;
    const equipped = activeResourcePack === item.packId;
    const isPreviewed = previewPackId === item.packId;
    const canAfford = balance >= item.price;

    return (
      <div
        key={item.id}
        onMouseEnter={() => setPreviewPackId(item.packId)}
        onClick={() => setPreviewPackId(item.packId)}
        className={`group flex cursor-pointer flex-col justify-between overflow-hidden border transition ${
          equipped
            ? 'border-amber-400 bg-[#1d180e] shadow-[0_0_20px_rgba(251,191,36,0.2)]'
            : isPreviewed
              ? 'border-cyan-400/70 bg-[#18202c]'
              : 'border-white/12 bg-[#161c26] hover:border-white/30'
        }`}
      >
        <div>
          {/* Live Voxel Graphics Thumbnail Scene */}
          <div className="relative h-24 w-full overflow-hidden border-b border-white/10">
            <ResourcePackShowcaseCanvas packId={item.packId} className="h-24 w-full" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/75 to-transparent" />
            <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
              {equipped && (
                <span className="bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-950">
                  Active
                </span>
              )}
              {item.badge && !equipped && (
                <span className="bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">
                  {item.badge}
                </span>
              )}
            </div>
            <div className="absolute bottom-1 left-2 flex items-center gap-1 text-[10px] font-bold text-white/90 drop-shadow">
              <Eye className="h-3 w-3 text-amber-300" />
              <span>{isPreviewed ? 'Previewing' : 'Click to Preview'}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 p-3 pb-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-white">{item.name}</span>
              <span className="text-[10px] font-semibold text-amber-200/80">{item.tagline}</span>
            </div>
            <p className="text-[11px] leading-snug text-slate-300">{item.description}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
          <span className="tabular-nums text-[11px] font-bold text-amber-300">
            {item.price === 0n ? 'FREE' : `${formatMineDollarsExact(item.price)} MD`}
          </span>

          {owned ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEquipResourcePack(item.packId);
                setPreviewPackId(item.packId);
                triggerNotice(`Resource Pack active: ${item.name}`);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold uppercase transition ${
                equipped
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-[#283244] text-white hover:bg-amber-400 hover:text-slate-950'
              }`}
            >
              <Check className="h-3 w-3" />
              {equipped ? 'Active' : 'Activate'}
            </button>
          ) : (
            <button
              type="button"
              disabled={!canAfford}
              onClick={(e) => {
                e.stopPropagation();
                handlePurchase(item);
                setPreviewPackId(item.packId);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold uppercase transition ${
                canAfford
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  : 'cursor-not-allowed bg-slate-700 text-slate-400'
              }`}
            >
              <Coins className="h-3 w-3" />
              Buy &amp; Apply
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Wallet Banner */}
      <div className="flex flex-col gap-1.5 border border-amber-400/40 bg-gradient-to-r from-[#1a180d] via-[#171d28] to-[#0f1d1a] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-300" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-200/80">
                MineDollars Balance
              </div>
              <div className="font-mono text-xs font-extrabold tracking-tight text-amber-300 break-all sm:text-sm">
                {formatMineDollarsExact(balance)} MineDollars
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            <button
              type="button"
              onClick={() => {
                onClaimBonusMineDollars();
                triggerNotice(`Added +${BONUS_MINEDOLLARS_STR} MineDollars!`);
              }}
              title={`Click to add +${BONUS_MINEDOLLARS_STR} MineDollars`}
              className="flex items-center gap-1 border border-amber-300 bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold text-slate-950 shadow transition hover:bg-amber-300 active:translate-y-0.5"
            >
              <Coins className="h-3.5 w-3.5 shrink-0" />
              <span>+ Get {formatMineDollarsCompact(BONUS_MINEDOLLARS)} MD</span>
            </button>
            <span className="border border-cyan-400/35 bg-cyan-950/40 px-2 py-0.5 font-semibold text-cyan-200">
              Look: {MARKETPLACE_RESOURCE_PACKS.find((p) => p.packId === activeResourcePack)?.name ?? activeResourcePack}
            </span>
            <span className="border border-emerald-400/35 bg-emerald-950/40 px-2 py-0.5 font-semibold text-emerald-200">
              {activeBehaviorPacks.length} Behavior {activeBehaviorPacks.length === 1 ? 'Pack' : 'Packs'} On
            </span>
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="grid grid-cols-2 gap-1.5 bg-[#0c1017] p-1 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setCategory('resource')}
          className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold transition ${
            category === 'resource'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Palette className="h-3.5 w-3.5" />
          Resource Packs
        </button>
        <button
          type="button"
          onClick={() => setCategory('behavior')}
          className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold transition ${
            category === 'behavior'
              ? 'bg-emerald-500 text-slate-950'
              : 'text-slate-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          Behavior Packs
        </button>
        <button
          type="button"
          onClick={() => setCategory('skins')}
          className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold transition ${
            category === 'skins'
              ? 'bg-purple-500 text-white'
              : 'text-slate-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <UserCheck className="h-3.5 w-3.5" />
          Skin Packs
        </button>
        <button
          type="button"
          onClick={() => setCategory('bundles')}
          className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold transition ${
            category === 'bundles'
              ? 'bg-cyan-500 text-slate-950'
              : 'text-slate-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          Crates &amp; Maps
        </button>
      </div>

      {/* Animated Live Graphics Stage on Resource Packs */}
      {category === 'resource' && (
        <div className="relative overflow-hidden border-2 border-amber-400/50 bg-[#0b0f17] shadow-[0_0_24px_rgba(251,191,36,0.16)]">
          <div className="h-32 w-full">
            <ResourcePackShowcaseCanvas
              packId={previewPackId}
              animated
              className="h-32 w-full"
            />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Live Graphics Showcase · {previewResource.tagline}
              </div>
              <div className="text-sm font-black text-white">{previewResource.name}</div>
            </div>
            {previewOwned ? (
              <button
                type="button"
                onClick={() => {
                  onEquipResourcePack(previewResource.packId);
                  triggerNotice(`Resource Pack active: ${previewResource.name}`);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase transition ${
                  previewEquipped
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                }`}
              >
                <Check className="h-3.5 w-3.5" />
                {previewEquipped ? 'Currently Equipped' : 'Apply Look Now'}
              </button>
            ) : (
              <button
                type="button"
                disabled={!previewAffordable}
                onClick={() => handlePurchase(previewResource)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase transition ${
                  previewAffordable
                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                    : 'cursor-not-allowed bg-slate-700 text-slate-400'
                }`}
              >
                <Coins className="h-3.5 w-3.5" />
                Unlock · {formatMineDollarsExact(previewResource.price)} MD
              </button>
            )}
          </div>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between gap-2 border border-emerald-400/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-200">
          <span className="flex min-w-0 items-center gap-1.5 break-all">
            <Store className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 text-[10px] font-bold uppercase text-emerald-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Store Grid */}
      <div className="grid max-h-[340px] grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
        {category === 'resource' && MARKETPLACE_RESOURCE_PACKS.map(renderResourceCard)}

        {category === 'behavior' &&
          MARKETPLACE_BEHAVIOR_PACKS.map((item) => {
            const owned = ownedSet.has(item.id);
            const active = activeBehaviorSet.has(item.id);
            const canAfford = balance >= item.price;

            return (
              <div
                key={item.id}
                className={`flex flex-col justify-between overflow-hidden border transition ${
                  active
                    ? 'border-emerald-400 bg-emerald-950/25 shadow-[0_0_16px_rgba(16,185,129,0.2)]'
                    : 'border-white/12 bg-[#161c26] hover:border-white/30'
                }`}
              >
                <div>
                  <div className="relative">
                    <BehaviorPackArtwork packId={item.id} />
                    {item.badge && (
                      <span className="absolute top-1.5 right-1.5 bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 p-3 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                      <span className="text-xs font-extrabold text-white">{item.name}</span>
                    </div>
                    <div className="text-[10px] font-semibold text-cyan-300">{item.tagline}</div>
                    <p className="text-[11px] leading-snug text-slate-300">{item.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
                  <span className="tabular-nums text-[11px] font-bold text-amber-300">
                    {formatMineDollarsExact(item.price)} MD
                  </span>

                  {owned ? (
                    <button
                      type="button"
                      onClick={() => {
                        onToggleBehaviorPack(item.id);
                        triggerNotice(`${item.name}: ${active ? 'Disabled' : 'Activated!'}`);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold uppercase transition ${
                        active
                          ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                          : 'bg-[#283244] text-slate-200 hover:bg-emerald-500/80 hover:text-slate-950'
                      }`}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {active ? 'Enabled' : 'Enable'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => handlePurchase(item)}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold uppercase transition ${
                        canAfford
                          ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                          : 'cursor-not-allowed bg-slate-700 text-slate-400'
                      }`}
                    >
                      <Coins className="h-3 w-3" />
                      Buy &amp; Enable
                    </button>
                  )}
                </div>
              </div>
            );
          })}

        {category === 'skins' &&
          MARKETPLACE_SKIN_PACKS.map((item) => {
            const owned = ownedSet.has(item.id);
            const equipped = activeSkinId === item.skin.id;
            const canAfford = balance >= item.price;

            return (
              <div
                key={item.id}
                className={`flex flex-col justify-between gap-2.5 border p-3 transition ${
                  equipped
                    ? 'border-purple-400 bg-purple-950/25 shadow-[0_0_16px_rgba(192,132,252,0.2)]'
                    : 'border-white/12 bg-[#161c26] hover:border-white/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <SkinFullShowcase skin={item.skin} accentColor={item.accentColor} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold text-white">{item.name}</div>
                    <div className="text-[10px] font-semibold text-purple-300">{item.tagline}</div>
                    <p className="mt-1 text-[11px] leading-snug text-slate-300">{item.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2">
                  <span className="tabular-nums text-[11px] font-bold text-amber-300">
                    {formatMineDollarsExact(item.price)} MD
                  </span>

                  {owned ? (
                    <button
                      type="button"
                      onClick={() => {
                        onEquipSkinFromMarketplace(item);
                        triggerNotice(`Equipped skin: ${item.name}`);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold uppercase transition ${
                        equipped
                          ? 'bg-purple-500 text-white'
                          : 'bg-[#283244] text-white hover:bg-purple-500'
                      }`}
                    >
                      <Check className="h-3 w-3" />
                      {equipped ? 'Equipped' : 'Equip Skin'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => handlePurchase(item)}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold uppercase transition ${
                        canAfford
                          ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                          : 'cursor-not-allowed bg-slate-700 text-slate-400'
                      }`}
                    >
                      <Coins className="h-3 w-3" />
                      Buy &amp; Equip
                    </button>
                  )}
                </div>
              </div>
            );
          })}

        {category === 'bundles' &&
          MARKETPLACE_BUNDLES.map((item) => {
            const owned = ownedSet.has(item.id) && !item.repeatable;
            const canAfford = balance >= item.price;

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between overflow-hidden border border-white/12 bg-[#161c26] transition hover:border-white/30"
              >
                <div>
                  <div className="relative">
                    <BundleArtwork item={item} />
                    {item.repeatable && (
                      <span className="absolute top-1.5 right-1.5 bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase text-cyan-200">
                        Crate
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 p-3 pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                      {item.worldPreset ? (
                        <Globe className="h-3.5 w-3.5 text-fuchsia-300" />
                      ) : (
                        <Package className="h-3.5 w-3.5 text-cyan-300" />
                      )}
                      {item.name}
                    </div>
                    <div className="text-[10px] font-semibold text-amber-200">{item.tagline}</div>
                    <p className="text-[11px] leading-snug text-slate-300">{item.description}</p>
                    {item.supplyItems && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.supplyItems.map((si) => (
                          <span
                            key={si.id}
                            className="border border-white/10 bg-[#10141c] px-1.5 py-0.5 text-[9px] text-slate-300"
                          >
                            {BLOCK_DEFS[si.id]?.name} ×{si.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
                  <span className="tabular-nums text-[11px] font-bold text-amber-300">
                    {formatMineDollarsExact(item.price)} MD
                  </span>

                  {owned && item.worldPreset ? (
                    <button
                      type="button"
                      onClick={() => onLaunchMarketplaceWorld(item)}
                      className="flex items-center gap-1 bg-emerald-500 px-2.5 py-1 text-[11px] font-extrabold uppercase text-slate-950 hover:bg-emerald-400"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      Play Map
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => handlePurchase(item)}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold uppercase transition ${
                        canAfford
                          ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                          : 'cursor-not-allowed bg-slate-700 text-slate-400'
                      }`}
                    >
                      <Coins className="h-3 w-3" />
                      {item.supplyItems ? 'Buy Crate' : 'Unlock & Play'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
