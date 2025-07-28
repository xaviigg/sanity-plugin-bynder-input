import React from 'react';
import { loadBynder } from '../utils';
import { ObjectInputProps, PatchEvent, set, unset } from 'sanity';
import VideoPlayer from './VideoPlayer';
import { Box, Button, Flex } from '@sanity/ui';
import { BynderAssetValue } from '../schema/bynder.asset';

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    BynderCompactView: any;
  }
}

export interface BynderConfig {
  portalDomain: string;
  language: 'en_US' | string;
}

export interface BynderInputProps extends ObjectInputProps<BynderAssetValue> {
  pluginConfig: BynderConfig;
}

export function BynderInput(props: BynderInputProps) {
  const { value, readOnly, schemaType, pluginConfig, onChange } = props;

  const removeValue = () => {
    onChange(PatchEvent.from([unset()]));
  };

  const getGifUrlFromAsset = (
    asset: Record<string, any>,
    portalDomain: string
  ): string | null => {
    const mediaId =
      asset.derivatives?.webImage?.match?.(/\/m\/([^/]+)\//)?.[1] ??
      asset.files?.webImage?.url?.match(/\/m\/([^/]+)\//)?.[1];

    if (!mediaId || !asset.name) return null;

    return `${portalDomain}/m/${mediaId}/${asset.name}.gif`;
  };

  const getPreviewUrl = (
    asset: Record<string, any>,
    addInfo: Record<string, any>,
    portalDomain: string
  ) => {
    if (asset.extensions?.includes('gif'))
      return getGifUrlFromAsset(asset, portalDomain);
    switch (asset.type) {
      case 'VIDEO':
        return asset.previewUrls[0];
      default:
        return addInfo.selectedFile
          ? addInfo.selectedFile?.url
          : asset.webImage.url;
    }
  };

  const getVideoUrl = (asset: Record<string, any>) => {
    if (asset.type === 'VIDEO') {
      // if original asset is available (public videos only) use that if not fall back to the preview url
      return asset.files?.original?.url ?? asset.previewUrls[0];
    }
    return null;
  };

  const getAspectRatio = (dimensions: {
    width: number;
    height: number;
  }): number => dimensions.height / dimensions.width;

  const getVideoAspectRatio = (previewImageUrl: string) =>
    new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        resolve(
          getAspectRatio({
            width: img.width,
            height: img.height,
          })
        );
      };
      img.onerror = (err) => reject(err);

      img.src = previewImageUrl;
    });

  const openMediaSelector = () => {
    const onSuccess = (
      assets: Record<string, any>[],
      addInfo: Record<string, any>
    ) => {
      const asset = assets[0];
      const webImage = asset.files.webImage;

      const aspectRatio = getAspectRatio({
        width: webImage.width,
        height: webImage.height,
      });
      const mediaData = {
        _key: value?._key,
        _type: schemaType.name,
        id: asset.id,
        name: asset.name,
        databaseId: asset.databaseId,
        type: asset.type,
        previewUrl: getPreviewUrl(asset, addInfo, pluginConfig.portalDomain),
        previewImg: webImage.url,
        datUrl: asset.files.transformBaseUrl?.url,
        videoUrl: getVideoUrl(asset),
        description: asset.description,
        aspectRatio,
        selectedUrl: addInfo.selectedFile?.url,
        width: webImage.width,
        height: webImage.height,
        // If Bynder supported mimeType in the schema, we could set it here
        //mimeType: webImage.mimeType,
      };

      if (asset.type === 'VIDEO') {
        getVideoAspectRatio(webImage.url)
          .then((ratio) => {
            onChange(
              PatchEvent.from([set({ ...mediaData, aspectRatio: ratio })])
            );
          })
          .catch((err) => {
            // video aspect ratio couldn't be set, but should still set the rest of the data
            // eslint-disable-next-line no-console
            console.error('Error setting video aspect ratio:', err);
            onChange(PatchEvent.from([set(mediaData)]));
          });
      } else {
        onChange(PatchEvent.from([set(mediaData)]));
      }
    };

    const options: Record<string, any> = {
      language: pluginConfig.language || 'en_US',
      portal: {
        url: pluginConfig.portalDomain,
      },
      theme: {
        colorPrimary: '#156dff',
        colorButtonPrimary: '#156dff',
      },
      mode: 'SingleSelectFile',
      onSuccess,
    };

    const { assetTypes, assetFilter } = schemaType.options;
    if (assetTypes) {
      options.assetTypes = assetTypes;
    }

    if (assetFilter) {
      options.assetFilter = assetFilter;
    }

    loadBynder(() => {
      window.BynderCompactView.open(options);
    });
  };

  let preview;
  if (value) {
    if (value.type === 'VIDEO') {
      preview = (
        <VideoPlayer
          controls
          poster={value.previewImg}
          sources={[{ src: value.previewUrl ?? '' }]}
        />
      );
    }
    if (value.type === 'IMAGE') {
      preview = (
        <img
          alt="preview"
          src={value.previewUrl}
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      );
      // TODO: Add preview for document / audio types and empty state
    }
  }

  return (
    <>
      <div style={{ textAlign: 'center' }}>{preview}</div>
      <Flex gap={2} style={{ width: '100%' }}>
        <Box flex={1}>
          <Button
            style={{ width: '100%' }}
            disabled={readOnly}
            mode="ghost"
            text={'Browse'}
            title="Select an asset"
            onClick={openMediaSelector}
          />
        </Box>
        <Box flex={1}>
          <Button
            style={{ width: '100%' }}
            disabled={readOnly || !value}
            tone="critical"
            mode="ghost"
            text={'Remove'}
            title="Remove asset"
            onClick={removeValue}
          />
        </Box>
      </Flex>
    </>
  );
}
