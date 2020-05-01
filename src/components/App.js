import React, { Fragment } from "react";
import { Button, FormGroup, Input, Label } from "reactstrap";
import { ReactComponent as UploadSvg } from "../img/upload-drop.svg";
import { ReactComponent as CheckboxAnimated } from "../img/checkbox-animated.svg";
import CryptoJS from "crypto-js";
import Dropzone from "react-dropzone";
import { Document, Page, pdfjs } from "react-pdf";
import axios from "axios";
import { verifyCredential } from "did-jwt-vc";
import { Resolver } from "did-resolver";
import { getResolver } from "ethr-did-resolver";
import Web3 from "web3";
import ReactJson from "react-json-view";

import "./accordion.scss";

const ENS_REGISTRY_PUBLIC_RESOLVER_ABI_JSON = require("../contracts/publicResolverAbi.json");
const ENS_REGISTRY_PUBLIC_RESOLVER_ADDRESS =
  "0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41";
const ENS_NODE =
  "0x3442daf145b62820466398f343a5666abd6b41e9144476431b4360e0007a214e";
const INFURA_URI = "https://mainnet.infura.io/v3/";
const INFURA_PROJECT_ID = "f89f8f95ce6c4199849037177b155d08";

const web3 = new Web3(
  new Web3.providers.HttpProvider(INFURA_URI + INFURA_PROJECT_ID)
);

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

const ensContract = new web3.eth.Contract(
  JSON.parse(ENS_REGISTRY_PUBLIC_RESOLVER_ABI_JSON.result),
  ENS_REGISTRY_PUBLIC_RESOLVER_ADDRESS
);

const providerConfig = {
  name: "rsk:testnet",
  registry: "0xdca7ef03e98e0dc2b855be647c39abe984fcf21b",
  rpcUrl: "https://did.testnet.rsk.co:4444",
};

const UNIRESOLVER_API = "https://uniresolver.io/1.0/identifiers/";

class App extends React.Component {
  state = {
    files: [],
    fileMD5: "",
    jwtMD5: "",
    pdfLink: "",
    did: "did:ethr:0x27dFC5414aa6Ca1515411392581e71af2Ef0B921",
    signerDID: "",
    signerName: "",
    subjectName: "",
    submitClicked: false,
    jwt: "",
    numPages: null,
    iatDate: "",
    nbfDate: "",
    issuanceDate: "",
    expirationDate: "",
    pageNumber: 1,

    verifiedVC: {},
  };

  componentDidMount = () => {
    const resolver = new Resolver(getResolver(providerConfig));
    this.setState({ resolver: resolver });
  };

  handleDidChange = (e) => {
    this.setState({ did: e.target.value });
  };

  handleOnDrop = async (files) => {
    files = files.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );

    const fileMD5 = await this.fileToMd5(files[0]);

    this.setState({ fileMD5: fileMD5 });
    this.setState({ files: files });
    this.setState({ pdfLink: files[0].preview });
  };

  handleFileSubmit = async (e) => {
    const jwtResponse = await axios.get(UNIRESOLVER_API + this.state.did);
    const jwt = jwtResponse.data.didDocument.service[0].serviceEndpoint;

    let verifiedVC;
    try {
      verifiedVC = await verifyCredential(jwt, this.state.resolver);
    } catch (e) {
      console.log(e);
      this.setState({ error: e.message });
      return;
    }

    console.log(verifiedVC);

    const iatDate = new Date(verifiedVC.payload.iat * 1000).toUTCString();
    const nbfDate = new Date(verifiedVC.payload.nbf * 1000).toUTCString();
    const expirationDate = new Date(
      verifiedVC.payload.vc.expirationDate
    ).toUTCString();
    const issuanceDate = new Date(
      verifiedVC.payload.vc.issuanceDate
    ).toUTCString();

    const signerDID = verifiedVC.signer.owner;
    const signerName = await this.getTxtRecord(signerDID);
    const subjectName = await this.getTxtRecord(
      verifiedVC.payload.vc.credentialSubject.id
    );
    const jwtMD5 =
      verifiedVC.payload.vc.credentialSubject.TexasNotary.documentHash;

    window.location.href = "#middle";
    window.vc = verifiedVC;

    this.setState({ iatDate });
    this.setState({ nbfDate });
    this.setState({ expirationDate });
    this.setState({ issuanceDate });
    this.setState({ decodedJwt: JSON.stringify(verifiedVC) });
    this.setState({ signerDID });
    this.setState({ jwt });
    this.setState({ verifiedVC });
    this.setState({ signerName });
    this.setState({ subjectName });
    this.setState({ jwtMD5 });
  };

  onDocumentLoadSuccess = ({ numPages }) => {
    this.setState({ numPages });
  };

  fileToMd5 = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", function () {
        const hash = CryptoJS.MD5(CryptoJS.enc.Latin1.parse(this.result));
        resolve(hash.toString(CryptoJS.enc.Hex));
      });

      reader.readAsBinaryString(file);
    });
  };

  getTxtRecord = async (didKey) => {
    let res = await ensContract.methods.text(ENS_NODE, didKey).call();
    return res;
  };

  renderTitle() {
    return <h1>Texas Digital Notary Verification</h1>;
  }

  renderDidForm() {
    return (
      <FormGroup>
        <Label for="documentTypeSelected" className="prompt">
          What is the DID for this document?
        </Label>
        <Input
          type="text"
          name="didInput"
          id="didInput"
          value={this.state.did}
          onChange={this.handleDidChange}
          placeholder="did:ethr:..."
        />
      </FormGroup>
    );
  }

  renderFileUploadDropzone() {
    const { files } = { ...this.state };

    return (
      <Dropzone onDrop={this.handleOnDrop}>
        {({ getRootProps, getInputProps }) => (
          <section className="dropzone-container">
            {files.length <= 0 && this.renderForm(getRootProps, getInputProps)}
            {files.length > 0 && this.renderPreview(files)}
          </section>
        )}
      </Dropzone>
    );
  }

  renderPreview(files) {
    if (files.length > 0) {
      const [oneFile] = [...files];
      return (
        <div>
          <Document
            file={oneFile.preview}
            onLoadSuccess={this.onDocumentLoadSuccess}
          >
            <Page pageNumber={this.state.pageNumber} />
          </Document>
          <p>
            <a
              href="#"
              onClick={() => {
                if (this.state.pageNumber - 1 >= 1) {
                  this.setState({ pageNumber: this.state.pageNumber - 1 });
                }
              }}
            >
              {" "}
              prev{" "}
            </a>
            Page {this.state.pageNumber} of {this.state.numPages}
            <a
              href="#"
              onClick={() => {
                if (this.state.pageNumber + 1 <= this.state.numPages) {
                  this.setState({ pageNumber: this.state.pageNumber + 1 });
                }
              }}
            >
              {" "}
              next{" "}
            </a>
          </p>
        </div>
      );
    } else {
      return <Fragment />;
    }
  }

  renderForm(getRootProps, getInputProps) {
    return (
      <div {...getRootProps()} className="dropzone-form">
        <input {...getInputProps()} />
        <div className="upload">
          <div className="caption">Upload your file by dropping it here...</div>
          <UploadSvg />
        </div>
      </div>
    );
  }

  renderJWT() {
    return (
      <div>
        <Label className="prompt">JWT:</Label>;<p>{this.state.jwt}</p>
      </div>
    );
  }

  renderSubmitButton() {
    return (
      <div style={{ paddingTop: "50px" }}>
        {/* <div class="spinner-border" role="status">
          <span class="sr-only">Loading...</span>
        </div> */}
        <Button
          className="margin-wide"
          color="primary"
          disabled={!this.state.files[0]}
          onClick={this.handleFileSubmit}
        >
          Submit
        </Button>
      </div>
    );
  }

  renderImageHashMatches() {
    return (
      <div>
        <input class="accordion-input" type="checkbox" id="chck5" />
        <label class="tab-label" for="chck5">
          <CheckboxAnimated /> Image Verification
        </label>
        <div class="tab-content">
          <div className="rcorners">
            <h5>The uploaded image matches the DID's image signature.</h5>
          </div>
          <p>Document Hash: {this.state.fileMD5} </p>
          <p> Did Document Hash: {this.state.jwtMD5}</p>
        </div>
      </div>
    );
  }

  renderImageHashDoesNotMatch() {
    return (
      <div>
        <input class="accordion-input" type="checkbox" id="chck5" />
        <label class="tab-label" for="chck5">
          <img style={{ width: "40px" }} src="./redx.png"></img> Image
          Verification
        </label>
        <div class="tab-content">
          <div className="rcorners-red">
            <h5 style={{ color: "white" }}>
              The uploaded image DOES NOT match the DID's image signature.
              Please check that the you have the correct image for the correct
              DID.
            </h5>
          </div>
          <p>Document Hash: {this.state.fileMD5} </p>
          <p> Did Document Hash: {this.state.jwtMD5}</p>
        </div>
      </div>
    );
  }

  renderSignerInformationValid() {
    return (
      <div>
        <input class="accordion-input" type="checkbox" id="chck3" />
        <label class="tab-label" for="chck3">
          <CheckboxAnimated />
          Signer Information
        </label>
        <div class="tab-content">
          <div className="rcorners">
            <h5>The signer of this document is a Verified Notary</h5>
          </div>
          <p> Signer DID: {this.state.signerDID} </p>
          <p> Signer Name: {this.state.signerName} - Verified Mypass Notary</p>
        </div>
      </div>
    );
  }

  renderSignerInformationNotValid() {
    return (
      <div>
        <input class="accordion-input" type="checkbox" id="chck3" />
        <label class="tab-label" for="chck3">
          <img style={{ width: "40px" }} src="./redx.png"></img>
          Signer Information
        </label>
        <div class="tab-content">
          <div className="rcorners-red">
            <h5 style={{ color: "white" }}>
              The signer of this document cannot be verified as a Verified
              Notary
            </h5>
          </div>
          <p> Signer DID: {this.state.signerDID} </p>
          <p> Signer Name: - UNABLE TO LOCATE SIGNER NAME! - </p>
        </div>
      </div>
    );
  }

  renderTimestampInformationValid() {
    return (
      <div>
        <input class="accordion-input" type="checkbox" id="chck4" />
        <label class="tab-label" for="chck4">
          <CheckboxAnimated /> Timestamp Information
        </label>
        <div class="tab-content">
          <div className="rcorners">
            <h5>The timestamp information is valid</h5>
          </div>
          <p>iat ( The time the JWT was issued ) : {this.state.iatDate}</p>
          <p>
            nbf ( The time before which the JWT MUST NOT be accepted ) :{" "}
            {this.state.nbfDate}
          </p>
          <p>
            Issuance Date ( Date of actual issuance ) :{" "}
            {this.state.issuanceDate}
          </p>
          <p>
            Expiration Date ( Date this document expires ) :{" "}
            {this.state.expirationDate}
          </p>
        </div>
      </div>
    );
  }

  renderTimestampInformationNotValid() {
    return (
      <div>
        <input class="accordion-input" type="checkbox" id="chck4" />
        <label class="tab-label" for="chck4">
          <img style={{ width: "40px" }} src="./redx.png"></img>Timestamp
          Information
        </label>
        <div class="tab-content">
          <div className="rcorners-red">
            <h5 style={{ color: "white" }}>
              The timestamp information is NOT valid
            </h5>
          </div>
          <p>iat ( The time the JWT was issued ) : {this.state.iatDate}</p>
          <p>
            nbf ( The time before which the JWT MUST NOT be accepted ) :{" "}
            {this.state.nbfDate}
          </p>
          <p>
            Issuance Date ( Date of actual issuance ) :{" "}
            {this.state.issuanceDate}
          </p>
          <p>
            Expiration Date ( Date this document expires ) :{" "}
            {this.state.expirationDate}
          </p>
        </div>
      </div>
    );
  }

  timestampsAreValid() {
    let valid = true;

    if (new Date(this.state.expirationDate) < new Date()) {
      valid = false;
    }

    if (new Date(this.state.iatDate) > new Date()) {
      valid = false;
    }

    if (new Date(this.state.nbfDate) > new Date()) {
      valid = false;
    }

    if (new Date(this.state.issuanceDate) > new Date()) {
      valid = false;
    }

    return valid;
  }
  renderTabs() {
    if (JSON.stringify(this.state.verifiedVC) === "{}") {
      return <Fragment />;
    } else {
      const vc = this.state.verifiedVC.payload.vc;
      const imagesMatches =
        this.state.fileMD5 === this.state.jwtMD5 ? true : false;
      const signerVerified = this.state.signerName === "" ? false : true;

      return (
        <div>
          <div className="rcorners">
            <p>
              This document is a{" "}
              <span className="keywords">
                {vc.credentialSubject.TexasNotary.type}
              </span>{" "}
              of a{" "}
              <span className="keywords">
                {vc.credentialSubject.TexasNotary.name}.{" "}
              </span>{" "}
              The subject of this document is{" "}
              <span className="keywords">{this.state.subjectName}</span> and the
              issuer is{" "}
              <span className="keywords">{this.state.signerName}</span>. This
              document was issued at{" "}
              <span className="keywords">{this.state.iatDate}</span> and the
              issuance Date is{" "}
              <span className="keywords">{this.state.issuanceDate}</span>. This
              document is not valid until{" "}
              <span className="keywords">{this.state.nbfDate}</span>. This
              document will expire on{" "}
              <span className="keywords">{this.state.expirationDate}</span>
            </p>
          </div>

          <div class="tabs">
            <div class="tab">
              <input class="accordion-input" type="checkbox" id="chck2" />
              <label class="tab-label" for="chck2">
                <CheckboxAnimated /> Document Information
              </label>
              <div class="tab-content">
                <div className="rcorners">
                  <h5>
                    This document well formed and has all needed information
                    present.
                  </h5>
                </div>

                <p>
                  Subject: {vc.credentialSubject.id} ({this.state.subjectName})
                </p>
                <p>
                  Issuer: {vc.issuer.id} ({this.state.signerName})
                </p>
                <div style={{ textAlign: "left" }}>
                  <ReactJson
                    src={JSON.parse(this.state.decodedJwt)}
                    theme="ocean"
                  />
                </div>
                {/* {this.state.decodedJwt} */}
              </div>
            </div>
            <div class="tab">
              {imagesMatches === true
                ? this.renderImageHashMatches()
                : this.renderImageHashDoesNotMatch()}
            </div>
            <div class="tab">
              {signerVerified === true
                ? this.renderSignerInformationValid()
                : this.renderSignerInformationNotValid()}
            </div>

            <div class="tab">
              {this.timestampsAreValid() === true
                ? this.renderTimestampInformationValid()
                : this.renderTimestampInformationNotValid()}
            </div>
          </div>
        </div>
      );
    }
  }

  renderFooter() {
    const imagesMatches =
      this.state.fileMD5 === this.state.jwtMD5 ? true : false;
    const signerVerified = this.state.signerName === "" ? false : true;
    const validtimestamps = this.timestampsAreValid();

    let validStamp =
      imagesMatches && signerVerified && validtimestamps ? true : false;

    if (JSON.stringify(this.state.verifiedVC) === "{}") {
      return <Fragment />;
    } else if (validStamp) {
      return (
        <div>
          <div>
            <img width="300px" src="./approved.png"></img>
          </div>

          <div class="alert alert-success" role="alert">
            <h4 class="alert-heading">This Document Is Verified!</h4>
            <p>
              This document has passed all verification steps and is a certified
              authentic document.
            </p>
            <hr />
            <p class="mb-0"></p>
          </div>
        </div>
      );
    } else {
      return (
        <div>
          <div class="alert alert-danger" role="alert">
            <h4 class="alert-heading">This Document Is Not Valid!!</h4>
            <p>This document has not passed all verification steps.</p>
            <hr />
            <p class="mb-0"></p>
          </div>
        </div>
      );
    }
  }

  render() {
    return (
      <div className="container">
        <div id="top" className="row top-section">
          <div className="col"></div>
          <div className="col-9 text-center">
            {this.renderTitle()}
            {this.renderDidForm()}
            {this.renderFileUploadDropzone()}
            {this.renderSubmitButton()}
            <hr />
          </div>
          <div className="col"></div>
        </div>
        <div id="middle" className="row middle-section">
          <div className="col"></div>
          <div className="col-9 text-center">{this.renderTabs()}</div>
          <div className="col"></div>
        </div>
        <div id="bottom" className="row bottom-section">
          <div className="col"></div>
          <div className="col-9 text-center">{this.renderFooter()}</div>
          <div className="col"></div>
        </div>
      </div>
    );
  }
}
export default App;
