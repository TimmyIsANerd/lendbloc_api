import { IAsset } from '../../models/Asset';

export function isAssetListed(asset: IAsset | null | undefined): boolean {
  return !!asset && asset.status === 'LISTED';
}

