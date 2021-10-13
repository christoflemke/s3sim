interface Params {
    Bucket: string
}

interface ListObjectsV2Params extends Params {
    Prefix: string
}

interface ListObjectVersionsParams extends ListObjectsV2Params {}

interface PutObjectParams extends Params {
    Key: string,
    Body: string
}

interface GetObjectParams extends Params {
    Key: string
}

interface DeleteParam {
    Key: string,
    VersionId?: string
}

interface DeleteObjectsParams extends Params {
    Delete: { Objects: DeleteParam[] }
}