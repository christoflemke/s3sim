// Params

// Responses

// Internal Representation

interface S3Bucket {
  Name: string
  objects: S3Object[]
  CreationDate: Date
}

interface S3Object {
  Key: string
  LastModified: Date
  versions: S3ObjectVersion[]
}

type S3ObjectVersion = S3DeletedObjectVersion | S3ActiveObjectVersion

interface S3DeletedObjectVersion {
  IsDeleted: true
  VersionId: string
}

interface S3ActiveObjectVersion {
  IsDeleted: false
  Content: string
  VersionId: string
  ETag: string
}
